import * as cheerio from "cheerio";

export type LottoDrawResponse = {
  data: {
    list: {
      tm1WnNo: number;
      tm2WnNo: number;
      tm3WnNo: number;
      tm4WnNo: number;
      tm5WnNo: number;
      tm6WnNo: number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    }[];
  };
};

const FETCH_OPTIONS = {
  method: "GET" as const,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://www.dhlottery.co.kr/",
    Accept: "application/json, text/javascript, */*; q=0.01",
  },
  cache: "no-store" as const,
};

export async function getLatestEpisode(): Promise<number | null> {
  try {
    // 동행복권은 보통 메인에서 최신 정보를 가져올 때 아래의 파라미터 없는 호출을 허용합니다.
    // srchLtEpsd를 0이나 빈값으로 보낼 경우 가장 최근 정보를 반환하는 속성을 이용합니다.
    const res = await fetch(
      "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=",
      FETCH_OPTIONS,
    );

    if (!res.ok) return null;

    const json = (await res.json()) as LottoDrawResponse;
    return json.data.list[0]?.ltEpsd || null;
  } catch (error) {
    console.error("Latest Episode Fetch Error:", error);
    return null;
  }
}

export async function fetchDrawByEpisode(
  episode: number,
): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=${episode}`,
      FETCH_OPTIONS,
    );
    if (!res.ok) return null;

    const json = (await res.json()) as LottoDrawResponse;
    const item = json.data.list[0];

    const numbers = [
      item.tm1WnNo,
      item.tm2WnNo,
      item.tm3WnNo,
      item.tm4WnNo,
      item.tm5WnNo,
      item.tm6WnNo,
    ];

    if (numbers.some((n) => n == null || Number.isNaN(n))) return null;
    return numbers.sort((a, b) => a - b);
  } catch {
    return null;
  }
}

export async function fetchLast6Draws(
  lastEpisode: number,
): Promise<number[][]> {
  const episodes = Array.from(
    { length: 6 },
    (_, i) => lastEpisode - 5 + i,
  ).filter((n) => n >= 1);

  const results = await Promise.all(
    episodes.map((ep) => fetchDrawByEpisode(ep)),
  );
  return results.filter((draw): draw is number[] => draw != null);
}

export async function fetchRecentDraws(): Promise<{
  latestEpisode: number;
  draws: number[][];
} | null> {
  const latestEpisode = await getLatestEpisode();
  if (!latestEpisode) return null;

  const draws = await fetchLast6Draws(latestEpisode);
  return { latestEpisode, draws };
}
