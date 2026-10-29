import { type LottoDraw, parseDrawResponse } from "./lotto-data";

export const DRAW_ENDPOINT =
  "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do";
export const DRAW_PAGE_SIZE = 20;
export const LATEST_DRAW_TTL_SECONDS = 300;
export const PAST_DRAW_TTL_SECONDS = 86_400;

type Snapshot = { draw: LottoDraw; checkedAt: string; sourceUrl: string };
/** 캐시는 정상 스냅샷만 저장한다. load의 실패는 기존 정상 값을 교체하지 않는다. */
export type DrawCache = (
  key: string,
  ttlSeconds: number,
  load: () => Promise<Snapshot>,
) => Promise<Snapshot>;

export type DrawResult = {
  episode: number | null;
  status:
    | "fresh"
    | "stale"
    | "empty"
    | "unavailable"
    | "invalid-range"
    | "cancelled";
  draw: LottoDraw | null;
  checkedAt: string | null;
  sourceUrl: string;
  failure: "http" | "network" | "timeout" | "invalid-response" | null;
};
export type DrawRangeResult = {
  status:
    | "fresh"
    | "stale"
    | "partial"
    | "empty"
    | "unavailable"
    | "invalid-range"
    | "latest-unknown"
    | "cancelled"
    | "insufficient-history";
  from: number | null;
  to: number | null;
  latest: DrawResult | null;
  slots: DrawResult[];
  missingEpisodes: number[];
};
type RequestOptions = { signal?: AbortSignal };
type ReaderOptions = {
  fetcher?: typeof fetch;
  cache?: DrawCache;
  now?: () => number;
  timeoutMs?: number;
};

class SourceError extends Error {
  constructor(public readonly result: DrawResult) {
    super("당첨 회차 원천을 확인하지 못했습니다.");
  }
}
const validEpisode = (n: number) => Number.isSafeInteger(n) && n > 0;
const sourceUrl = (n?: number) => `${DRAW_ENDPOINT}?srchLtEpsd=${n ?? ""}`;
function failureResult(
  n: number | undefined,
  status: DrawResult["status"],
  failure: DrawResult["failure"] = null,
  checkedAt: string | null = null,
): DrawResult {
  return {
    episode: n ?? null,
    status,
    draw: null,
    checkedAt,
    sourceUrl: sourceUrl(n),
    failure,
  };
}

/** 메모리에는 진행 중 요청만 보관한다. 정상 데이터의 보존은 주입한 캐시가 담당한다. */
export function createDrawReader(options: ReaderOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const cache: DrawCache = options.cache ?? ((_key, _ttl, load) => load());
  const inFlight = new Map<string, Promise<DrawResult>>();
  const sourceInFlight = new Map<string, Promise<Snapshot>>();
  const waiters: Array<() => void> = [];
  let active = 0;

  async function limited<T>(load: () => Promise<T>): Promise<T> {
    if (active >= 3)
      await new Promise<void>((resolve) => waiters.push(resolve));
    else active++;
    try {
      return await load();
    } finally {
      const next = waiters.shift();
      if (next) next();
      else active--;
    }
  }

  function loadSource(n?: number): Promise<Snapshot> {
    const key = n === undefined ? "latest" : String(n);
    const existing = sourceInFlight.get(key);
    if (existing) return existing;
    const pending = limited(async () => {
      const signal = AbortSignal.timeout(options.timeoutMs ?? 5000);
      try {
        const res = await fetcher(sourceUrl(n), {
          method: "GET",
          cache: "no-store",
          signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok)
          throw new SourceError(failureResult(n, "unavailable", "http"));
        const payload: unknown = await res.json();
        // 현재 공식 정상 응답의 resultCode는 null이다. 다른 코드를 성공으로 추정하지 않는다.
        if (
          payload !== null &&
          typeof payload === "object" &&
          "resultCode" in payload &&
          payload.resultCode !== null
        ) {
          throw new SourceError(
            failureResult(n, "unavailable", "invalid-response"),
          );
        }
        const checkedAt = new Date(now()).toISOString();
        const draw = parseDrawResponse(payload, n);
        if (!draw) {
          const list = (payload as { data?: { list?: unknown } } | null)?.data
            ?.list;
          if (Array.isArray(list) && list.length === 0) {
            throw new SourceError(failureResult(n, "empty", null, checkedAt));
          }
          throw new SourceError(
            failureResult(n, "unavailable", "invalid-response"),
          );
        }
        return { draw, checkedAt, sourceUrl: sourceUrl(n) };
      } catch (error) {
        if (signal.aborted)
          throw new SourceError(failureResult(n, "unavailable", "timeout"));
        if (error instanceof SourceError) throw error;
        throw new SourceError(
          failureResult(
            n,
            "unavailable",
            error instanceof SyntaxError ? "invalid-response" : "network",
          ),
        );
      }
    });
    sourceInFlight.set(key, pending);
    void pending.then(
      () => sourceInFlight.delete(key),
      () => sourceInFlight.delete(key),
    );
    return pending;
  }

  function read(
    n: number | undefined,
    request: RequestOptions = {},
  ): Promise<DrawResult> {
    if (n !== undefined && !validEpisode(n))
      return Promise.resolve(failureResult(n, "invalid-range"));
    if (request.signal?.aborted)
      return Promise.resolve(failureResult(n, "cancelled"));
    const key = n === undefined ? "latest" : String(n);
    let pending = inFlight.get(key);
    if (!pending) {
      const ttl =
        n === undefined ? LATEST_DRAW_TTL_SECONDS : PAST_DRAW_TTL_SECONDS;
      pending = (async (): Promise<DrawResult> => {
        try {
          const snapshot = await cache(key, ttl, () => loadSource(n));
          const age = now() - Date.parse(snapshot.checkedAt);
          return {
            episode: snapshot.draw.episode,
            draw: snapshot.draw,
            checkedAt: snapshot.checkedAt,
            sourceUrl: snapshot.sourceUrl,
            failure: null,
            status:
              Number.isFinite(age) && age >= 0 && age < ttl * 1000
                ? "fresh"
                : "stale",
          };
        } catch (error) {
          return error instanceof SourceError
            ? error.result
            : failureResult(n, "unavailable", "network");
        }
      })();
      inFlight.set(key, pending);
      void pending.finally(() => inFlight.delete(key));
    }
    if (!request.signal) return pending;
    // 공유 원천 요청을 중단하지 않고 이 소비자만 취소한다. 이전 결과가 새 화면에 전달되지 않는다.
    const signal = request.signal;
    return new Promise((resolve) => {
      const abort = () => resolve(failureResult(n, "cancelled"));
      signal.addEventListener("abort", abort, { once: true });
      void pending.then((result) => {
        signal.removeEventListener("abort", abort);
        resolve(signal.aborted ? failureResult(n, "cancelled") : result);
      });
    });
  }

  function rangeResult(
    slots: DrawResult[],
    from: number | null,
    to: number | null,
    latest: DrawResult | null = null,
    forced?: DrawRangeResult["status"],
  ): DrawRangeResult {
    const good = slots.filter((slot) => slot.draw !== null);
    return {
      from,
      to,
      latest,
      slots,
      missingEpisodes: slots
        .filter((slot) => slot.draw === null && slot.episode !== null)
        .map((slot) => slot.episode!),
      status:
        forced ??
        (slots.some((s) => s.status === "cancelled")
          ? "cancelled"
          : good.length === slots.length && good.length > 0
            ? good.some((s) => s.status === "stale")
              ? "stale"
              : "fresh"
            : good.length > 0
              ? "partial"
              : slots.length > 0 && slots.every((s) => s.status === "empty")
                ? "empty"
                : "unavailable"),
    };
  }

  async function readSlots(
    episodes: number[],
    request: RequestOptions,
    seed?: DrawResult,
  ) {
    const slots = new Array<DrawResult>(episodes.length);
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, episodes.length) }, async () => {
        while (cursor < episodes.length) {
          const index = cursor++;
          const n = episodes[index];
          slots[index] = request.signal?.aborted
            ? failureResult(n, "cancelled")
            : seed?.draw?.episode === n
              ? seed
              : await read(n, request);
        }
      }),
    );
    return slots;
  }

  return {
    readDraw: (episode: number, request?: RequestOptions) =>
      read(episode, request),
    readLatest: (request?: RequestOptions) => read(undefined, request),
    async readRange(
      to?: number,
      request: RequestOptions = {},
    ): Promise<DrawRangeResult> {
      if (to !== undefined && !validEpisode(to))
        return rangeResult([], null, null, null, "invalid-range");
      const latest = await read(undefined, request);
      if (latest.status === "cancelled")
        return rangeResult([], null, to ?? null, latest, "cancelled");
      // 오래된 최신 포인터는 현재 상한으로 쓰지 않는다. 명시된 과거 구간은 별도로 조회한다.
      const confirmed =
        latest.status === "fresh" ? latest.draw?.episode : undefined;
      if (to === undefined && confirmed === undefined)
        return rangeResult([], null, null, latest, "latest-unknown");
      if (to !== undefined && confirmed !== undefined && to > confirmed)
        return rangeResult([], null, to, latest, "invalid-range");
      const upper = to ?? confirmed!;
      const lower = Math.max(1, upper - DRAW_PAGE_SIZE + 1);
      const episodes = Array.from(
        { length: upper - lower + 1 },
        (_, i) => upper - i,
      );
      return rangeResult(
        await readSlots(
          episodes,
          request,
          latest.status === "fresh" ? latest : undefined,
        ),
        lower,
        upper,
        latest,
      );
    },
    async readPrevious(
      episode: number,
      request: RequestOptions = {},
    ): Promise<DrawRangeResult> {
      if (!validEpisode(episode))
        return rangeResult([], null, null, null, "invalid-range");
      const count = Math.min(5, episode - 1);
      const episodes = Array.from({ length: count }, (_, i) => episode - i - 1);
      const slots = await readSlots(episodes, request);
      return rangeResult(
        slots,
        count ? episode - count : null,
        count ? episode - 1 : null,
        null,
        request.signal?.aborted
          ? "cancelled"
          : count < 5
            ? "insufficient-history"
            : undefined,
      );
    },
  };
}
