import { randomUUID } from "node:crypto";

import {
  canonicalDraw,
  type FailureCode,
  type OfficialSource,
  SyncError,
} from "./lotto-archive/source";
import type { ArchiveStore, Lease, RunStatus } from "./lotto-archive/store";

export type SyncSummary = {
  status: RunStatus;
  requests: number;
  succeeded: number;
  failed: number;
  code?: FailureCode;
  warnings: string[];
};
type Options = {
  store: ArchiveStore;
  source: OfficialSource;
  invalidate: (round: number, latest: boolean) => Promise<void>;
  kind?: "daily" | "manual";
  rounds?: number[];
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
  deadlineAt?: number;
};

/** 공개 reader는 호출하지 않는다. 모든 실행이 DB lease와 일일 예산을 공유한다. */
export async function runSync(options: Options): Promise<SyncSummary> {
  const { store, source, invalidate } = options;
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const start = now();
  const deadline = Math.min(start + 20000, options.deadlineAt ?? Infinity);
  const result: SyncSummary = {
    status: "skipped",
    requests: 0,
    succeeded: 0,
    failed: 0,
    warnings: [],
  };
  let lease: Lease | null = null;
  let lastStart = -Infinity;
  async function clearPending(round: number, latest: boolean) {
    try {
      await invalidate(round, latest);
      await store.invalidated(lease!, round);
    } catch {
      result.warnings.push("cache");
      result.code ??= "cache";
    }
  }
  try {
    lease = await store.acquire(randomUUID(), options.kind ?? "daily");
    if (!lease) return result;
    const plan = await store.plan(lease);
    if (plan.usage === null) result.warnings.push("usage-unknown");
    else if (plan.usage >= 70) result.warnings.push("usage-warning");
    for (const pending of plan.pending) {
      if (now() + 1000 >= deadline) break;
      await clearPending(pending.round, pending.latest);
    }
    if (plan.usage !== null && plan.usage >= 95) {
      result.code = "usage-limit";
      return result;
    }
    const optional = plan.usage !== null && plan.usage < 85;
    const tried = new Set<number>();
    async function collect(round?: number): Promise<number | null> {
      if (round !== undefined && tried.has(round)) return null;
      if (result.requests >= 3) return null;
      if (options.signal?.aborted) throw new SyncError("deadline");
      const wait = Math.max(0, lastStart + 1000 - now());
      if (now() + wait + 5000 + 1000 > deadline) {
        result.code ??= "deadline";
        return null;
      }
      if (wait) await sleep(wait);
      const reservation = await store.reserve(lease!, round);
      if (reservation.allowed === false) return null;
      if (round !== undefined) tried.add(round);
      result.requests++;
      lastStart = now();
      let record;
      try {
        // 주입한 원천도 5초로 제한한다. HTTP 원천은 응답 본문까지 취소한다.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const controller = new AbortController();
        const requestSignal = options.signal
          ? AbortSignal.any([controller.signal, options.signal])
          : controller.signal;
        let onAbort: (() => void) | undefined;
        try {
          // 원천 함수 호출 전에 취소 리스너를 등록해 동기 취소도 놓치지 않는다.
          const timeout = new Promise<never>((_, reject) => {
            onAbort = () =>
              reject(
                new SyncError(options.signal?.aborted ? "deadline" : "timeout"),
              );
            requestSignal.addEventListener("abort", onAbort, { once: true });
            timer = setTimeout(
              () => controller.abort(),
              Math.min(5000, deadline - now()),
            );
          });
          if (requestSignal.aborted) throw new SyncError("deadline");
          record = await Promise.race([timeout, source(round, requestSignal)]);
        } finally {
          clearTimeout(timer);
          if (onAbort) requestSignal.removeEventListener("abort", onAbort);
        }
        record = { ...record, draw: canonicalDraw(record.draw) };
        if (round !== undefined && record.draw.episode !== round)
          throw new SyncError("invalid");
        if (round === undefined) {
          const draw = record.draw;
          const drawAt = Date.parse(`${draw.drawDate}T00:00:00Z`);
          const age = now() - drawAt;
          // 최신 응답의 날짜·회차 이상만 거부한다. 과거 요일을 고정하지 않는다.
          const expectedOffset =
            (Date.parse(draw.drawDate) - Date.UTC(2002, 11, 7)) /
            (7 * 86400000);
          if (
            Math.abs(expectedOffset - (draw.episode - 1)) > 1 ||
            age < 0 ||
            age > 8 * 86400000
          )
            throw new SyncError("schedule");
          if (
            plan.latest !== null &&
            (draw.episode < plan.latest ||
              draw.episode >
                plan.latest +
                  Math.ceil(
                    Math.max(
                      0,
                      now() - Date.parse(plan.latestCheckedAt ?? ""),
                    ) /
                      (7 * 86400000),
                  ) +
                  1)
          )
            throw new SyncError("latest-regression");
        }
      } catch (error) {
        const failure =
          error instanceof SyncError ? error : new SyncError("network");
        result.failed++;
        result.code = failure.code;
        await store.failure(lease!, round, failure.code, failure.retryAt);
        if (failure.code === "blocked") throw failure;
        return null;
      }
      tried.add(record.draw.episode);
      await store.save(lease!, record, round === undefined);
      result.succeeded++;
      await clearPending(record.draw.episode, round === undefined);
      return record.draw.episode;
    }
    const latestAllowed =
      !plan.latestRetryAt || Date.parse(plan.latestRetryAt) <= now();
    const latest = latestAllowed ? await collect() : null;
    // 최신 확인 실패 시 추정한 최신/보정 창으로 수집을 확대하지 않는다.
    if (latest !== null && optional) {
      if (options.kind === "manual" && options.rounds?.length) {
        for (const round of options.rounds) {
          if (round <= latest) await collect(round);
        }
      } else {
        if (latest > 1) await collect(latest - 1);
        const updated = await store.plan(lease);
        for (const round of [...updated.failures, ...updated.missing])
          await collect(round);
      }
    }
    result.status =
      result.failed || result.warnings.includes("cache")
        ? result.succeeded
          ? "partial"
          : "failed"
        : result.succeeded
          ? "success"
          : "skipped";
  } catch (error) {
    result.code = error instanceof SyncError ? error.code : "storage";
    result.status = result.succeeded ? "partial" : "failed";
  } finally {
    if (lease) {
      try {
        result.warnings = [...new Set(result.warnings)];
        await store.finish(lease, result.status, result.code);
      } catch {
        result.status = result.succeeded ? "partial" : "failed";
        result.code = "storage";
      }
    }
  }
  return result;
}
