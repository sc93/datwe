import { unstable_cache } from "next/cache";
import { connection } from "next/server";

import { createDrawReader, type DrawCache } from "./draw-reader";

const readCache: DrawCache = (key, ttl, load) =>
  unstable_cache(load, ["lotto-draw-record-v1", key], {
    revalidate: ttl,
    tags: ["lotto-archive", `lotto-archive-${key}`],
  })();

// 공유 메모리는 진행 중 요청/대기열만 보관한다. 데이터는 Next Data Cache에 둔다.
const reader = createDrawReader({ cache: readCache });

export async function fetchLatestDraw(signal?: AbortSignal) {
  await connection();
  return reader.readLatest({ signal });
}

export async function fetchDraw(episode: number, signal?: AbortSignal) {
  await connection();
  return reader.readDraw(episode, { signal });
}

export async function fetchDrawRange(to?: number, signal?: AbortSignal) {
  await connection();
  return reader.readRange(to, { signal });
}

export async function fetchDrawPrevious(episode: number, signal?: AbortSignal) {
  await connection();
  return reader.readPrevious(episode, { signal });
}
