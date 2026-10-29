import type { Metadata } from "next";
import { cache } from "react";

import { loadDrawDetail } from "@/lib/draw-detail";
import { fetchDraw, fetchLatestDraw } from "@/lib/draw-dhlottery";
import { drawDetailMetadata, invalidDrawMetadata } from "@/lib/draw-metadata";
import {
  drawHref,
  type DrawQuery,
  parseDrawQuery,
  parseRoundInput,
} from "@/lib/draw-navigation";

import {
  DrawDetailScreen,
  InvalidDrawScreen,
} from "../_components/draw-screens";

type Props = {
  params: Promise<{ round: string }>;
  searchParams: Promise<DrawQuery>;
};
const readDetail = cache((episode: number) =>
  loadDrawDetail(episode, {
    latest: () => fetchLatestDraw(),
    draw: fetchDraw,
  }),
);
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { round } = await params;
  const parsed = parseRoundInput(round, null);
  const query = parseDrawQuery(await searchParams);
  if (!/^\d+$/.test(round) || parsed.error || !query.valid)
    return invalidDrawMetadata();
  const data = await readDetail(parsed.episode!);
  if (
    query.to !== undefined &&
    data.latest.status === "fresh" &&
    data.latest.draw &&
    query.to > data.latest.draw.episode
  )
    return invalidDrawMetadata();
  return drawDetailMetadata(data, parsed.episode!);
}
export default async function DrawDetailPage({ params, searchParams }: Props) {
  const { round } = await params,
    parsed = parseRoundInput(round, null),
    query = parseDrawQuery(await searchParams);
  if (!/^\d+$/.test(round) || parsed.error || !query.valid)
    return <InvalidDrawScreen />;
  const episode = parsed.episode!;
  const initial = await readDetail(episode);
  if (
    query.to !== undefined &&
    initial.latest.status === "fresh" &&
    initial.latest.draw &&
    query.to > initial.latest.draw.episode
  )
    return <InvalidDrawScreen />;
  return (
    <DrawDetailScreen
      key={drawHref(episode, query.to)}
      initial={initial}
      episode={episode}
      to={query.to}
    />
  );
}
