export function parseRoundInput(value: string, latest: number | null) {
  const text = value.trim();
  const episode = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(episode) || episode < 1)
    return {
      episode: null,
      error: "1 이상의 회차 번호를 정수로 입력해 주세요.",
    };
  if (latest !== null && episode > latest)
    return {
      episode: null,
      error: `확인된 최신 회차인 ${latest}회까지 입력해 주세요.`,
    };
  return { episode, error: null };
}
export type DrawQuery = Record<string, string | string[] | undefined>;
export function parseDrawQuery(query: DrawQuery): {
  valid: boolean;
  to: number | undefined;
} {
  if (Object.keys(query).some((key) => key !== "to") || Array.isArray(query.to))
    return { valid: false, to: undefined };
  if (query.to === undefined) return { valid: true, to: undefined };
  if (!/^\d+$/.test(query.to)) return { valid: false, to: undefined };
  const result = parseRoundInput(query.to, null);
  return { valid: result.error === null, to: result.episode ?? undefined };
}
export const listHref = (to?: number) =>
  to === undefined ? "/draw" : `/draw?to=${to}`;
export const drawHref = (episode: number, to?: number) =>
  `/draw/${episode}${to === undefined ? "" : `?to=${to}`}`;
export function rangeNavigation(to: number, latest: number | null) {
  return {
    previous: to > 20 ? to - 20 : null,
    next: latest !== null && to < latest ? Math.min(latest, to + 20) : null,
  };
}
