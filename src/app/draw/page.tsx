import type { Metadata } from "next";
import { cache } from "react";

import { fetchDrawRange } from "@/lib/draw-dhlottery";
import { drawListMetadata, invalidDrawMetadata } from "@/lib/draw-metadata";
import {
  type DrawQuery,
  listHref,
  parseDrawQuery,
} from "@/lib/draw-navigation";

import { DrawListScreen, InvalidDrawScreen } from "./_components/draw-screens";

const readList = cache((to?: number) => fetchDrawRange(to));

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<DrawQuery>;
}): Promise<Metadata> {
  const query = parseDrawQuery(await searchParams);
  if (!query.valid) return invalidDrawMetadata();
  return drawListMetadata(await readList(query.to), query.to);
}
export default async function DrawPage({
  searchParams,
}: {
  searchParams: Promise<DrawQuery>;
}) {
  const query = parseDrawQuery(await searchParams);
  if (!query.valid) return <InvalidDrawScreen />;
  const initial = await readList(query.to);
  return (
    <DrawListScreen key={listHref(query.to)} initial={initial} to={query.to} />
  );
}
