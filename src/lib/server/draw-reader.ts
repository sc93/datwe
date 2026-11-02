import type { LottoDraw } from "../lotto/lotto-data";

export const DRAW_ENDPOINT =
  "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do";
export const DRAW_PAGE_SIZE = 20;
export const LATEST_DRAW_TTL_SECONDS = 300;
export const PAST_DRAW_TTL_SECONDS = 86_400;

export type DrawSnapshot = {
  draw: LottoDraw;
  checkedAt: string;
  sourceUrl: string;
};
/** 캐시는 정상 스냅샷만 저장한다. load의 실패는 기존 정상 값을 교체하지 않는다. */
export type DrawCache = (
  key: string,
  ttlSeconds: number,
  load: () => Promise<DrawSnapshot>,
) => Promise<DrawSnapshot>;

export type DrawResult = {
  episode: number | null;
  status:
    | "fresh"
    | "stale"
    | "not-collected"
    | "unavailable"
    | "invalid-range"
    | "cancelled";
  draw: LottoDraw | null;
  checkedAt: string | null;
  sourceUrl: string;
  failure: "database" | null;
};
export type DrawRangeResult = {
  status:
    | "fresh"
    | "stale"
    | "partial"
    | "not-collected"
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
  loadSnapshot: (episode?: number) => Promise<DrawSnapshot | null>;
  isFresh: (snapshot: DrawSnapshot, episode?: number) => boolean;
  cache?: DrawCache;
};

class SnapshotError extends Error {
  constructor(public readonly result: DrawResult) {
    super("당첨 회차 기록을 확인하지 못했습니다.");
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
export function createDrawReader(options: ReaderOptions) {
  const cache: DrawCache = options.cache ?? ((_key, _ttl, load) => load());
  const inFlight = new Map<string, Promise<DrawResult>>();
  const loadInFlight = new Map<string, Promise<DrawSnapshot>>();
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

  function loadSnapshot(n?: number): Promise<DrawSnapshot> {
    const key = n === undefined ? "latest" : String(n);
    const existing = loadInFlight.get(key);
    if (existing) return existing;
    const pending = limited(async () => {
      try {
        const snapshot = await options.loadSnapshot(n);
        if (!snapshot)
          throw new SnapshotError(failureResult(n, "not-collected"));
        return snapshot;
      } catch (error) {
        if (error instanceof SnapshotError) throw error;
        throw new SnapshotError(failureResult(n, "unavailable", "database"));
      }
    });
    loadInFlight.set(key, pending);
    void pending.then(
      () => loadInFlight.delete(key),
      () => loadInFlight.delete(key),
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
          const snapshot = await cache(key, ttl, () => loadSnapshot(n));
          return {
            episode: snapshot.draw.episode,
            draw: snapshot.draw,
            checkedAt: snapshot.checkedAt,
            sourceUrl: snapshot.sourceUrl,
            failure: null,
            status: options.isFresh(snapshot, n) ? "fresh" : "stale",
          };
        } catch (error) {
          return error instanceof SnapshotError
            ? error.result
            : failureResult(n, "unavailable", "database");
        }
      })();
      inFlight.set(key, pending);
      void pending.finally(() => inFlight.delete(key));
    }
    if (!request.signal) return pending;
    // 공유 DB 조회를 중단하지 않고 이 소비자만 취소한다. 이전 결과가 새 화면에 전달되지 않는다.
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
              : slots.length > 0 &&
                  slots.every((s) => s.status === "not-collected")
                ? "not-collected"
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
      const stored = latest.draw?.episode;
      if (to === undefined && confirmed === undefined && stored === undefined)
        return rangeResult([], null, null, latest, "latest-unknown");
      if (to !== undefined && confirmed !== undefined && to > confirmed)
        return rangeResult([], null, to, latest, "invalid-range");
      const upper = to ?? confirmed ?? stored!;
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
