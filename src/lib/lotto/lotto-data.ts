export type LottoDraw = {
  episode: number;
  drawDate: string;
  numbers: number[];
  bonus: number;
};

export type LottoData = {
  status: "fresh" | "stale" | "partial" | "not-collected" | "unavailable";
  latestEpisode: number | null;
  draws: LottoDraw[];
  checkedAt: string | null;
  missingEpisodes: number[];
  /** DB 조회는 다음 추첨 경계까지 유효하다. null은 공식 최신 미확인이다. */
  validUntil: string | null;
};

export const RECENT_DRAW_COUNT = 5;

export function getLottoDataAtTime(
  data: LottoData,
  now = Date.now(),
): LottoData {
  if (data.status !== "fresh" && data.status !== "partial") return data;
  const checked = Date.parse(data.checkedAt ?? "");
  const until = Date.parse(data.validUntil ?? "");
  return Number.isFinite(checked) && checked <= now && now < until
    ? data
    : { ...data, status: "stale" };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function isEpisode(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function isNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 45
  );
}
function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{8}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date.toISOString().slice(0, 10);
}

/** 외부 응답을 검증한다. 최신 행이 손상돼도 과거 회차로 대체하지 않는다. */
export function parseDrawResponse(
  payload: unknown,
  expectedEpisode?: number,
): LottoDraw | null {
  const list = record(record(payload)?.data)?.list;
  if (!Array.isArray(list) || list.length === 0) return null;
  const rows = list.map(record);
  if (rows.some((row) => !isEpisode(row?.ltEpsd))) return null;
  const episodes = rows.map((row) => row!.ltEpsd as number);
  if (new Set(episodes).size !== episodes.length) return null;
  const episode = expectedEpisode ?? Math.max(...episodes);
  const row = rows.find((item) => item?.ltEpsd === episode);
  if (!row) return null;
  const drawDate = parseDate(row.ltRflYmd);
  const numbers = [
    row.tm1WnNo,
    row.tm2WnNo,
    row.tm3WnNo,
    row.tm4WnNo,
    row.tm5WnNo,
    row.tm6WnNo,
  ];
  if (
    !drawDate ||
    !numbers.every(isNumber) ||
    new Set(numbers).size !== 6 ||
    !isNumber(row.bnsWnNo) ||
    numbers.includes(row.bnsWnNo)
  )
    return null;
  return {
    episode,
    drawDate,
    numbers: numbers.sort((a, b) => a - b),
    bonus: row.bnsWnNo,
  };
}

export function getDrawAvailability(data: LottoData) {
  const live = data.status === "fresh" || data.status === "partial";
  const episodes = data.draws.map((draw) => draw.episode).sort((a, b) => b - a);
  return {
    recentFive:
      data.status === "fresh" &&
      data.latestEpisode !== null &&
      data.missingEpisodes.length === 0 &&
      episodes.length === RECENT_DRAW_COUNT &&
      episodes.every((ep, i) => ep === data.latestEpisode! - i),
    carryOver:
      live &&
      data.latestEpisode !== null &&
      data.draws.some((draw) => draw.episode === data.latestEpisode),
  };
}

/** DATWE API 재확인 응답의 최소 계약. 손상 응답으로 정상 스토어를 덮지 않는다. */
export function parseRecentDatabaseData(value: unknown): LottoData | null {
  const data = record(value);
  if (
    !data ||
    !["fresh", "stale", "partial", "not-collected", "unavailable"].includes(
      String(data.status),
    ) ||
    !Array.isArray(data.draws) ||
    !Array.isArray(data.missingEpisodes) ||
    !(data.latestEpisode === null || isEpisode(data.latestEpisode)) ||
    !(
      data.checkedAt === null ||
      (typeof data.checkedAt === "string" &&
        Number.isFinite(Date.parse(data.checkedAt)))
    ) ||
    !(
      data.validUntil === null ||
      (typeof data.validUntil === "string" &&
        Number.isFinite(Date.parse(data.validUntil)))
    ) ||
    !data.missingEpisodes.every(isEpisode)
  )
    return null;
  for (const value of data.draws) {
    const draw = record(value);
    if (
      !draw ||
      !isEpisode(draw.episode) ||
      typeof draw.drawDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(draw.drawDate) ||
      parseDate(draw.drawDate.replaceAll("-", "")) !== draw.drawDate ||
      !Array.isArray(draw.numbers) ||
      draw.numbers.length !== 6 ||
      !draw.numbers.every(isNumber) ||
      new Set(draw.numbers).size !== 6 ||
      !isNumber(draw.bonus) ||
      draw.numbers.includes(draw.bonus)
    )
      return null;
  }
  if (
    new Set(data.draws.map((draw) => record(draw)!.episode)).size !==
    data.draws.length
  )
    return null;
  return data as unknown as LottoData;
}
