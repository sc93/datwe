import { NextResponse } from "next/server";

import { getLatestEpisode } from "@/lib/lotto-dhlottery";

export async function GET() {
  try {
    const latestRound = await getLatestEpisode();
    if (!latestRound) {
      return NextResponse.json(
        { error: "회차 정보를 찾을 수 없습니다." },
        { status: 500 },
      );
    }

    // 결과값만 심플하게 반환
    return NextResponse.json({ latestRound });
  } catch {
    return NextResponse.json(
      { error: "데이터를 가져오는데 실패했습니다." },
      { status: 500 },
    );
  }
}
