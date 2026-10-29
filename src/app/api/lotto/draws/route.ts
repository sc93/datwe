import { NextResponse } from "next/server";

import { fetchDrawRange } from "@/lib/draw-dhlottery";
import { type DrawQuery, parseDrawQuery } from "@/lib/draw-navigation";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query: DrawQuery = {};
  for (const key of params.keys()) {
    const values = params.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  const parsed = parseDrawQuery(query);
  if (!parsed.valid)
    return NextResponse.json(
      { error: "invalid-range" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const data = await fetchDrawRange(parsed.to, request.signal);
  const status =
    data.status === "invalid-range"
      ? 400
      : ["unavailable", "latest-unknown"].includes(data.status)
        ? 503
        : 200;
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
