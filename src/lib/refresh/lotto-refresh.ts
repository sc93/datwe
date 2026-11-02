import {
  getLottoDataAtTime,
  type LottoData,
  parseRecentDatabaseData,
} from "../lotto/lotto-data";

export const RECENT_RECHECK_MS = 60000;

/** SSR 갱신과 API 재확인이 같은 정상 기록 보존 규칙을 사용한다. */
export function mergeRecentData(
  current: LottoData | null,
  next: LottoData,
  now = Date.now(),
): LottoData {
  if (!current?.draws.length) return getLottoDataAtTime(next, now);
  if (
    next.status === "unavailable" ||
    next.status === "not-collected" ||
    next.latestEpisode === null ||
    (current.latestEpisode !== null &&
      current.latestEpisode > next.latestEpisode)
  )
    return getLottoDataAtTime(current, now);

  const records = new Map(current.draws.map((draw) => [draw.episode, draw]));
  for (const draw of next.draws) records.set(draw.episode, draw);
  const episodes = Array.from(
    { length: Math.min(5, next.latestEpisode) },
    (_, i) => next.latestEpisode! - i,
  );
  const draws = episodes.flatMap((episode) => {
    const draw = records.get(episode);
    return draw ? [draw] : [];
  });
  const missingEpisodes = episodes.filter((episode) => !records.has(episode));
  return getLottoDataAtTime(
    {
      ...next,
      draws,
      missingEpisodes,
      status:
        next.status === "partial" &&
        draws.length === 5 &&
        !missingEpisodes.length
          ? "fresh"
          : next.status,
    },
    now,
  );
}

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
        if (next) options.set(mergeRecentData(options.get(), next, now()));
      } catch {
        /* 정상 기록과 원천 확인시각을 유지한다. */
      } finally {
        pending = null;
      }
    })();
    return pending;
  };
}
