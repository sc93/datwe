import { NextResponse } from "next/server";

import { fetchRecentDraws } from "@/lib/lotto-dhlottery";

/**
 * GET Handler
 */
export async function GET() {
  const result = await fetchRecentDraws();
  if (!result) {
    return NextResponse.json(
      { error: "최신 회차를 가져올 수 없습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json(result);
}
