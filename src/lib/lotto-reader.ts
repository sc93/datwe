import {
  DRAW_FRESHNESS_MS,
  getLottoDataAtTime,
  type LottoData,
  parseDrawResponse,
  RECENT_DRAW_COUNT,
} from "./lotto-data";

export const CACHE_SECONDS = DRAW_FRESHNESS_MS / 1000;
const REQUEST_TIMEOUT_MS = 5000;
const ENDPOINT = "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do";

type ReaderOptions = { now?: () => number; timeoutMs?: number };

function unavailable(): LottoData {
  return {
    status: "unavailable",
    latestEpisode: null,
    draws: [],
    checkedAt: null,
    missingEpisodes: [],
  };
}

async function requestDraw(
  fetcher: typeof fetch,
  episode: number | undefined,
  timeoutMs: number,
) {
  try {
    const res = await fetcher(`${ENDPOINT}?srchLtEpsd=${episode ?? ""}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.dhlottery.co.kr/",
        Accept: "application/json, text/javascript, */*; q=0.01",
      },
    });
    if (!res.ok) return null;
    const payload: unknown = await res.json();
    return parseDrawResponse(payload, episode);
  } catch {
    return null;
  }
}

/** 최신 조회 한 번 + 나머지 4회 병렬 조회. 누락을 제외해 5회처럼 취급하지 않는다. */
export async function loadLottoData(
  fetcher: typeof fetch = fetch,
  options: ReaderOptions = {},
): Promise<LottoData> {
  const timeout = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const latest = await requestDraw(fetcher, undefined, timeout);
  if (!latest) return unavailable();
  const episodes = Array.from(
    { length: RECENT_DRAW_COUNT },
    (_, i) => latest.episode - i,
  ).filter((ep) => ep > 0);
  const previous = await Promise.all(
    episodes.slice(1).map((ep) => requestDraw(fetcher, ep, timeout)),
  );
  const draws = [latest, ...previous.filter((draw) => draw !== null)].sort(
    (a, b) => b.episode - a.episode,
  );
  const missingEpisodes = episodes.filter(
    (ep) => !draws.some((draw) => draw.episode === ep),
  );
  return {
    status:
      draws.length === RECENT_DRAW_COUNT && missingEpisodes.length === 0
        ? "fresh"
        : "partial",
    latestEpisode: latest.episode,
    draws,
    checkedAt: new Date((options.now ?? Date.now)()).toISOString(),
    missingEpisodes,
  };
}

export class IncompleteLottoDataError extends Error {
  constructor(public readonly data: LottoData) {
    super("연속된 당첨 회차를 모두 확인하지 못했습니다.");
    this.name = "IncompleteLottoDataError";
  }
}

/** 실패/부분 응답을 throw해 Next 데이터 캐시의 기존 정상 스냅샷을 덮어쓰지 않는다. */
export async function requireCompleteLottoData(
  fetcher: typeof fetch = fetch,
  options: ReaderOptions = {},
) {
  const data = await loadLottoData(fetcher, options);
  if (data.status !== "fresh") throw new IncompleteLottoDataError(data);
  return data;
}

export async function readLottoData(
  readCache: () => Promise<LottoData>,
  now = Date.now,
): Promise<LottoData> {
  try {
    const cached = await readCache();
    return getLottoDataAtTime(cached, now());
  } catch (error) {
    return error instanceof IncompleteLottoDataError
      ? error.data
      : unavailable();
  }
}
