import { NextResponse } from "next/server";

import { type DrawQuery, parseDrawQuery } from "@/lib/draw/draw-navigation";
import { fetchDrawRange } from "@/lib/server/draw-db";

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
  function getResponseStatus() {
    if (data.status === "invalid-range") {
      return 400;
    }
    if (["unavailable", "latest-unknown"].includes(data.status)) {
      return 503;
    }
    return 200;
  }
  const status = getResponseStatus();
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
