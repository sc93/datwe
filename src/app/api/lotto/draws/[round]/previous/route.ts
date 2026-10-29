import { NextResponse } from "next/server";

import { fetchDrawPrevious, fetchLatestDraw } from "@/lib/draw-dhlottery";
import { parseRoundInput } from "@/lib/draw-navigation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ round: string }> },
) {
  const { round } = await params,
    parsed = parseRoundInput(round, null);
  if (!/^\d+$/.test(round) || parsed.error || new URL(request.url).search)
    return NextResponse.json(
      { error: "invalid-range" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const latest = await fetchLatestDraw(request.signal);
  if (
    latest.status === "fresh" &&
    latest.draw &&
    parsed.episode! > latest.draw.episode
  )
    return NextResponse.json(
      { error: "invalid-range" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const data = await fetchDrawPrevious(parsed.episode!, request.signal);
  return NextResponse.json(data, {
    status: data.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
