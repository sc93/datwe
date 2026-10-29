import assert from "node:assert/strict";
import test from "node:test";

import type { DrawRangeResult, DrawResult } from "../src/lib/draw-reader";
import { mergeDrawRange } from "../src/lib/draw-refresh";
import { draw } from "./lotto-fixtures";

const slot = (episode: number, found: boolean): DrawResult => ({
  episode,
  draw: found ? draw(episode) : null,
  status: found ? "fresh" : "unavailable",
  checkedAt: found ? "2026-10-29T00:00:00.000Z" : null,
  sourceUrl: "https://example.test",
  failure: found ? null : "network",
});
const range = (slots: DrawResult[]): DrawRangeResult => ({
  status: "partial",
  from: 1,
  to: 2,
  latest: null,
  slots,
  missingEpisodes: slots.filter((s) => !s.draw).map((s) => s.episode!),
});
test("같은 구간 재시도는 실패한 슬롯의 기존 정상 기록을 시각과 함께 보존한다", () => {
  const previous = range([slot(2, true), slot(1, false)]);
  const next = range([slot(2, false), slot(1, true)]);
  const merged = mergeDrawRange(previous, next);
  assert.equal(merged.slots[0].draw, previous.slots[0].draw);
  assert.equal(merged.slots[0].status, "stale");
  assert.equal(merged.slots[0].checkedAt, previous.slots[0].checkedAt);
  assert.equal(merged.slots[1].draw, next.slots[1].draw);
  assert.equal(next.slots[0].draw, null);
});
test("다른 구간 응답에는 이전 회차를 혼입하지 않는다", () => {
  const next = { ...range([slot(3, true)]), from: 3, to: 3 };
  assert.equal(mergeDrawRange(range([slot(2, true)]), next), next);
});
