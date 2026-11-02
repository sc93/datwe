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

test("SSR 장애와 부분 재조회는 기존 정상 회차를 보존하고 추첨 경계를 재검사한다", async () => {
  const { mergeRecentData } = await import("../src/lib/refresh/lotto-refresh");
  const original = completeData();
  const afterBoundary = Date.parse("2026-10-31T12:00:00Z");
  const failed = mergeRecentData(
    original,
    {
      status: "unavailable",
      latestEpisode: null,
      draws: [],
      checkedAt: null,
      missingEpisodes: [],
      validUntil: null,
    },
    afterBoundary,
  );
  assert.equal(failed.status, "stale");
  assert.equal(failed.checkedAt, original.checkedAt);
  assert.deepEqual(failed.draws, original.draws);
  const partial = mergeRecentData(
    original,
    {
      ...original,
      status: "partial",
      draws: original.draws.slice(0, 2),
      missingEpisodes: original.draws.slice(2).map((d) => d.episode),
    },
    Date.parse("2026-10-29T00:00:00Z"),
  );
  assert.deepEqual(partial.draws, original.draws);
  assert.deepEqual(partial.missingEpisodes, []);
  assert.equal(partial.status, "fresh");
});
