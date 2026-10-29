import assert from "node:assert/strict";
import test from "node:test";

import { loadDrawDetail } from "../src/lib/draw-detail";
import type { DrawResult } from "../src/lib/draw-reader";
import { draw } from "./lotto-fixtures";

const latest: DrawResult = {
  episode: 1247,
  status: "fresh",
  draw: draw(),
  checkedAt: "2026-10-29T00:00:00Z",
  sourceUrl: "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do",
  failure: null,
};
test("확인된 최신 초과 상세는 대상 원천을 요청하지 않는다", async () => {
  let calls = 0;
  const data = await loadDrawDetail(1248, {
    latest: async () => latest,
    draw: async () => {
      calls++;
      return latest;
    },
  });
  assert.equal(data.target.status, "invalid-range");
  assert.equal(calls, 0);
});
test("최신 미확인이나 만료 시 과거 상세를 별도로 조회한다", async () => {
  for (const status of ["unavailable", "stale"] as const) {
    const data = await loadDrawDetail(600, {
      latest: async () => ({ ...latest, status }),
      draw: async (n) => ({ ...latest, episode: n, draw: draw(n) }),
    });
    assert.equal(data.target.draw?.episode, 600);
    assert.equal(data.latest.status, status);
  }
});
