import assert from "node:assert/strict";
import test from "node:test";

import { createRecentRefresh } from "../src/lib/refresh/lotto-refresh";
import { completeData } from "./lotto-fixtures";

test("클라이언트는 DATWE API만 재확인하고 동시 요청과60초내 반복을 합친다", async () => {
  let data = { ...completeData(), validUntil: "2026-10-31T11:35:00Z" };
  let clock = Date.parse("2026-10-28T00:00:00Z");
  let calls = 0;
  const refresh = createRecentRefresh({
    get: () => data,
    set: (next) => {
      data = next as typeof data;
    },
    now: () => clock,
    fetcher: async (url) => {
      assert.equal(url, "/api/lotto/recent-draws");
      calls++;
      return Response.json({ ...data, validUntil: "2026-11-07T11:35:00Z" });
    },
  });
  await Promise.all([refresh(), refresh()]);
  assert.equal(calls, 1);
  await refresh();
  assert.equal(calls, 1);
  clock += 60000;
  await refresh();
  assert.equal(calls, 2);
});

test("재확인 실패·잘못된 응답은 정상 기록과 원천 확인시각을 보존한다", async () => {
  const original = { ...completeData(), validUntil: "2026-10-31T11:35:00Z" };
  let data = original;
  const refresh = createRecentRefresh({
    get: () => data,
    set: (next) => {
      data = next as typeof data;
    },
    now: () => Date.parse("2026-10-31T12:00:00Z"),
    fetcher: async () => Response.json({ status: "fresh", draws: "broken" }),
  });
  await refresh();
  assert.equal(data.status, "stale");
  assert.equal(data.checkedAt, original.checkedAt);
  assert.deepEqual(data.draws, original.draws);
});
