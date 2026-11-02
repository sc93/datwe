import "server-only";

import { unstable_cache } from "next/cache";
import { connection } from "next/server";

import { createArchiveDrawReader } from "./archive-draw-reader";
import type { DrawCache } from "./draw-reader";
import { databaseTarget } from "./lotto-archive/admin";
import { drawCacheTags } from "./lotto-cache";
import { archiveReader } from "./lotto-db";

const readCache: DrawCache = (key, ttl, load) => {
  const target =
    databaseTarget("reader", process.env) === "production"
      ? process.env.DATABASE_PRODUCTION_HOST
      : process.env.DATABASE_ISOLATED_HOST;
  return unstable_cache(
    load,
    ["lotto-db-record-v1", target ?? "unconfigured", key],
    {
      revalidate: ttl,
      tags: drawCacheTags(key),
    },
  )();
};
// 진행 중 DB 조회만 메모리에서 공유한다. 영속 스냅샷은 Next Data Cache가 담당한다.
const reader = createArchiveDrawReader({
  cache: readCache,
  database: () => archiveReader(AbortSignal.timeout(5000)),
});

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
export async function fetchRecentDatabaseDraws() {
  await connection();
  return reader.readRecent();
}
