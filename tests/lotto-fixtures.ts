import type { LottoData, LottoDraw } from "../src/lib/lotto-data";

export function rawDraw(episode = 1247) {
  const date = new Date(Date.UTC(2026, 9, 24 - (1247 - episode) * 7));
  return {
    ltEpsd: episode,
    ltRflYmd: date.toISOString().slice(0, 10).replaceAll("-", ""),
    tm1WnNo: 8,
    tm2WnNo: 14,
    tm3WnNo: 21,
    tm4WnNo: 22,
    tm5WnNo: 42,
    tm6WnNo: 45,
    bnsWnNo: 24,
  };
}
export function response(episode = 1247) {
  return { data: { list: [rawDraw(episode)] } };
}
export function draw(episode = 1247): LottoDraw {
  const raw = rawDraw(episode);
  return {
    episode,
    drawDate: `${raw.ltRflYmd.slice(0, 4)}-${raw.ltRflYmd.slice(4, 6)}-${raw.ltRflYmd.slice(6)}`,
    numbers: [8, 14, 21, 22, 42, 45],
    bonus: 24,
  };
}
export function completeData(): LottoData {
  return {
    status: "fresh",
    latestEpisode: 1247,
    checkedAt: "2026-10-28T00:00:00.000Z",
    missingEpisodes: [],
    draws: Array.from({ length: 5 }, (_, i) => draw(1247 - i)),
  };
}
