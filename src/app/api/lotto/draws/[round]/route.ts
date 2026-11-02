import { NextResponse } from "next/server";

import { loadDrawDetail } from "@/lib/draw/draw-detail";
import { parseRoundInput } from "@/lib/draw/draw-navigation";
import { fetchDraw, fetchLatestDraw } from "@/lib/server/draw-db";

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
  const data = await loadDrawDetail(parsed.episode!, {
    latest: () => fetchLatestDraw(request.signal),
    draw: (n) => fetchDraw(n, request.signal),
  });
  return NextResponse.json(data, {
    status:
      data.target.status === "invalid-range"
        ? 400
        : data.target.status === "unavailable"
          ? 503
          : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
