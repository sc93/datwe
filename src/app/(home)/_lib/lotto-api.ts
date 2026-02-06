/**
 * 동행복권 API 응답 (selectPstLt645Info.do)
 * 당첨번호: tm1WnNo ~ tm6WnNo, 보너스: bnsWnNo
 */
export type LottoDrawResponse = {
  resultCode: null;
  resultMessage: null;
  data: {
    list: {
      bnsWnNo: number;
      excelRnk: string;
      gmSqNo: number;
      ltEpsd: number;
      ltRflYmd: string;
      rlvtEpsdSumNtslAmt: number;
      rnk1SumWnAmt: number;
      rnk1WnAmt: number;
      rnk1WnNope: number;
      rnk2SumWnAmt: number;
      rnk2WnAmt: number;
      rnk2WnNope: number;
      rnk3SumWnAmt: number;
      rnk3WnAmt: number;
      rnk3WnNope: number;
      rnk4SumWnAmt: number;
      rnk4WnAmt: number;
      rnk4WnNope: number;
      rnk5SumWnAmt: number;
      rnk5WnAmt: number;
      rnk5WnNope: number;
      sumWnNope: number;
      tm1WnNo: number;
      tm2WnNo: number;
      tm3WnNo: number;
      tm4WnNo: number;
      tm5WnNo: number;
      tm6WnNo: number;
      wholEpsdSumNtslAmt: number;
      winType0: number;
      winType1: number;
      winType2: number;
      winType3: number;
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

/**
 * 특정 회차 당첨번호 조회 후 6개 번호 배열 반환 (오름차순)
 */
export async function fetchDrawByEpisode(
  episode: number,
): Promise<number[] | null> {
  const res = await fetch(
    `https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=${episode}`,
    FETCH_OPTIONS,
  );

  if (!res.ok) return null;

  const data = (await res.json()) as LottoDrawResponse;

  const numbers = [
    data.data.list[0].tm1WnNo,
    data.data.list[0].tm2WnNo,
    data.data.list[0].tm3WnNo,
    data.data.list[0].tm4WnNo,
    data.data.list[0].tm5WnNo,
    data.data.list[0].tm6WnNo,
  ];

  if (numbers.some((n) => n == null || Number.isNaN(n))) return null;
  return numbers.sort((a, b) => a - b);
}

/**
 * 마지막 회차 기준 최근 6회차(마지막 5회 전 포함) 당첨번호 조회
 * [last-5, last-4, last-3, last-2, last-1, last] 순서
 */
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
