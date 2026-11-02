import { NextResponse } from "next/server";

import { fetchRecentDraws } from "@/lib/draw-db";

export async function GET() {
  const result = await fetchRecentDraws();
  return NextResponse.json(result, {
    status: result.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
