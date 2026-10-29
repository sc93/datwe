import type { Metadata } from "next";

import { loadDrawDetail } from "@/lib/draw-detail";
import { fetchDraw, fetchLatestDraw } from "@/lib/draw-dhlottery";
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
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { round } = await params,
    parsed = parseRoundInput(round, null);
  const valid = /^\d+$/.test(round) && parsed.error === null;
  return {
    title: valid
      ? `제 ${parsed.episode}회 당첨번호 | DATWE 다음주 퇴사`
      : "주소 확인 | DATWE 다음주 퇴사",
    alternates: { canonical: valid ? drawHref(parsed.episode!) : "/draw" },
    ...(!valid ? { robots: { index: false, follow: false } } : {}),
  };
}
export default async function DrawDetailPage({ params, searchParams }: Props) {
  const { round } = await params,
    parsed = parseRoundInput(round, null),
    query = parseDrawQuery(await searchParams);
  if (!/^\d+$/.test(round) || parsed.error || !query.valid)
    return <InvalidDrawScreen />;
  const episode = parsed.episode!;
  const initial = await loadDrawDetail(episode, {
    latest: () => fetchLatestDraw(),
    draw: fetchDraw,
  });
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
