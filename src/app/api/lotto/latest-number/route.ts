import { NextResponse } from "next/server";

import { fetchRecentDraws } from "@/lib/lotto-dhlottery";

export async function GET() {
  const result = await fetchRecentDraws();
  return NextResponse.json(
    {
      latestRound: result.latestEpisode,
      status: result.status,
      checkedAt: result.checkedAt,
    },
    {
      status: result.status === "unavailable" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
