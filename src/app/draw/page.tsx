import type { Metadata } from "next";

import { fetchDrawRange } from "@/lib/draw-dhlottery";
import {
  type DrawQuery,
  listHref,
  parseDrawQuery,
} from "@/lib/draw-navigation";

import { DrawListScreen, InvalidDrawScreen } from "./_components/draw-screens";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<DrawQuery>;
}): Promise<Metadata> {
  const query = parseDrawQuery(await searchParams);
  return {
    title: "회차별 당첨번호 | DATWE 다음주 퇴사",
    alternates: { canonical: query.valid ? listHref(query.to) : "/draw" },
    ...(!query.valid ? { robots: { index: false, follow: false } } : {}),
  };
}
export default async function DrawPage({
  searchParams,
}: {
  searchParams: Promise<DrawQuery>;
}) {
  const query = parseDrawQuery(await searchParams);
  if (!query.valid) return <InvalidDrawScreen />;
  const initial = await fetchDrawRange(query.to);
  return (
    <DrawListScreen key={listHref(query.to)} initial={initial} to={query.to} />
  );
}
