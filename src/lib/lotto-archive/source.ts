import { createHash } from "node:crypto";

import { type LottoDraw, parseDrawResponse } from "../lotto-data";

const ENDPOINT = "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do";
export type FailureCode =
  | "timeout"
  | "network"
  | "blocked"
  | "invalid"
  | "empty"
  | "request-budget"
  | "usage-limit"
  | "lease-lost"
  | "cache"
  | "storage"
  | "latest-regression"
  | "schedule"
  | "deadline";
export class SyncError extends Error {
  constructor(
    public readonly code: FailureCode,
    public readonly retryAt?: string,
  ) {
    super(code);
  }
}
export type VerifiedDraw = {
  draw: LottoDraw;
  sourceUrl: string;
  verifiedAt: string;
};
export type OfficialSource = (
  round?: number,
  signal?: AbortSignal,
) => Promise<VerifiedDraw>;

export function canonicalDraw(draw: LottoDraw): LottoDraw {
  const time = Date.parse(`${draw.drawDate}T00:00:00Z`);
  if (
    !Number.isSafeInteger(draw.episode) ||
    draw.episode < 1 ||
    draw.episode > 2147483647 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(draw.drawDate) ||
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== draw.drawDate ||
    draw.drawDate < "2002-12-07" ||
    draw.numbers.length !== 6 ||
    new Set(draw.numbers).size !== 6 ||
    ![...draw.numbers, draw.bonus].every(
      (n) => Number.isInteger(n) && n >= 1 && n <= 45,
    ) ||
    draw.numbers.includes(draw.bonus)
  )
    throw new SyncError("invalid");
  return {
    episode: draw.episode,
    drawDate: draw.drawDate,
    numbers: [...draw.numbers].sort((a, b) => a - b),
    bonus: draw.bonus,
  };
}
export function drawHash(draw: LottoDraw) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalDraw(draw)))
    .digest("hex");
}

export function createOfficialSource(
  fetcher: typeof fetch = fetch,
  options: { now?: () => number; timeoutMs?: number } = {},
): OfficialSource {
  const now = options.now ?? Date.now;
  return async (round, signal) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new SyncError("timeout"));
      }, options.timeoutMs ?? 5000);
    });
    try {
      if (signal?.aborted) throw new SyncError("deadline");
      const request = async () => {
        const sourceUrl = `${ENDPOINT}?srchLtEpsd=${round ?? ""}`;
        const response = await fetcher(sourceUrl, {
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (response.status === 403 || response.status === 429) {
          const retry = response.headers.get("retry-after");
          const at =
            retry && /^\d+$/.test(retry)
              ? now() + Number(retry) * 1000
              : Date.parse(retry ?? "");
          throw new SyncError(
            "blocked",
            !Number.isNaN(at)
              ? new Date(Math.min(at, Date.UTC(9999, 11, 31))).toISOString()
              : undefined,
          );
        }
        if (!response.ok) throw new SyncError("network");
        if (response.headers.get("content-type")?.includes("text/html"))
          throw new SyncError("blocked");
        // 원문은 저장·로깅하지 않는다. 큰 차단/오류 페이지도 메모리에서 제한한다.
        const reader = response.body?.getReader();
        if (!reader) throw new SyncError("empty");
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > 65536) throw new SyncError("invalid");
            chunks.push(part.value);
          }
        } finally {
          void reader.cancel().catch(() => {});
        }
        const text = Buffer.concat(chunks).toString("utf8");
        if (/^\s*</.test(text)) throw new SyncError("blocked");
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          throw new SyncError("invalid");
        }
        if (
          payload &&
          typeof payload === "object" &&
          "resultCode" in payload &&
          payload.resultCode !== null
        )
          throw new SyncError("invalid");
        const draw = parseDrawResponse(payload, round);
        if (!draw) {
          const list = (payload as { data?: { list?: unknown } } | null)?.data
            ?.list;
          throw new SyncError(
            Array.isArray(list) && list.length === 0 ? "empty" : "invalid",
          );
        }
        return {
          draw: canonicalDraw(draw),
          sourceUrl,
          verifiedAt: new Date(now()).toISOString(),
        };
      };
      return await Promise.race([request(), timeout]);
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw new SyncError(
        signal?.aborted
          ? "deadline"
          : controller.signal.aborted
            ? "timeout"
            : "network",
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
}
