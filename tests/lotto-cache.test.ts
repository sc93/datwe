import assert from "node:assert/strict";
import test from "node:test";

import {
  drawCacheTags,
  invalidateDrawCaches,
} from "../src/lib/server/lotto-cache";

test("정기 수집·외부 적재는 회차·목록·최신의 같은 캐시 태그를 갱신한다", async () => {
  assert.deepEqual(drawCacheTags("1247"), ["lotto-db-round-1247"]);
  assert.deepEqual(drawCacheTags("latest"), [
    "lotto-db-latest",
    "lotto-db-list",
  ]);
  const tags: string[] = [];
  await invalidateDrawCaches([1247, 1247, 1248], true, (tag) => {
    tags.push(tag);
  });
  assert.deepEqual(tags, [
    "lotto-db-list",
    "lotto-db-round-1247",
    "lotto-db-round-1248",
    "lotto-db-latest",
  ]);
});
