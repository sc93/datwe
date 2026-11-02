import {
  getLottoDataAtTime,
  type LottoData,
  parseRecentDatabaseData,
} from "./lotto-data";

export const RECENT_RECHECK_MS = 60000;

/** 탭 복귀·조건 선택·생성 전 서버 재확인을 공유하고 반복 요청을 제한한다. */
export function createRecentRefresh(options: {
  get: () => LottoData | null;
  set: (data: LottoData) => void;
  fetcher?: typeof fetch;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let lastAttempt = -Infinity;
  let pending: Promise<void> | null = null;
  return function refresh(): Promise<void> {
    if (pending) return pending;
    const previous = options.get();
    if (previous) options.set(getLottoDataAtTime(previous, now()));
    if (now() - lastAttempt < RECENT_RECHECK_MS) return Promise.resolve();
    lastAttempt = now();
    pending = (async () => {
      try {
        const response = await (options.fetcher ?? fetch)(
          "/api/lotto/recent-draws",
          { cache: "no-store", signal: AbortSignal.timeout(5000) },
        );
        if (!response.ok) return;
        const next = parseRecentDatabaseData(await response.json());
        const current = options.get();
        if (
          !next ||
          next.status === "unavailable" ||
          (next.status === "not-collected" && !!current?.draws.length) ||
          (current?.latestEpisode &&
            next.latestEpisode &&
            current.latestEpisode > next.latestEpisode)
        )
          return;
        options.set(getLottoDataAtTime(next, now()));
      } catch {
        /* 정상 기록과 원천 확인시각을 유지한다. */
      } finally {
        pending = null;
      }
    })();
    return pending;
  };
}
