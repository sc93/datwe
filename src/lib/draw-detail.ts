import { DRAW_ENDPOINT, type DrawResult } from "./draw-reader";

export type DrawDetailData = { target: DrawResult; latest: DrawResult };
export async function loadDrawDetail(
  episode: number,
  source: {
    latest: () => Promise<DrawResult>;
    draw: (episode: number) => Promise<DrawResult>;
  },
): Promise<DrawDetailData> {
  const latest = await source.latest();
  if (
    latest.status === "cancelled" ||
    (latest.status === "fresh" && latest.draw && episode > latest.draw.episode)
  ) {
    return {
      latest,
      target: {
        episode,
        draw: null,
        checkedAt: null,
        sourceUrl: `${DRAW_ENDPOINT}?srchLtEpsd=${episode}`,
        failure: null,
        status: latest.status === "cancelled" ? "cancelled" : "invalid-range",
      },
    };
  }
  return { latest, target: await source.draw(episode) };
}
