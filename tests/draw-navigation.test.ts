import assert from "node:assert/strict";
import test from "node:test";

import {
  drawHref,
  listHref,
  parseDrawQuery,
  parseRoundInput,
  rangeNavigation,
} from "../src/lib/draw-navigation";

test("정확 검색은 공백·선행0을 정규화하고 잘못된 입력과 최신 초과를 거부한다", () => {
  assert.deepEqual(parseRoundInput(" 00047 ", 1247), {
    episode: 47,
    error: null,
  });
  for (const value of [
    "",
    " ",
    "0",
    "-1",
    "1.5",
    "1e2",
    "abc",
    "1248",
    "9007199254740992",
  ]) {
    assert.notEqual(parseRoundInput(value, 1247).error, null);
  }
  assert.equal(parseRoundInput("600", null).episode, 600);
  assert.notEqual(parseRoundInput("1 2", null).error, null);
});
test("주소 파라미터는 단일 to만 허용하고 외부 복귀·중복·충돌을 거부한다", () => {
  assert.deepEqual(parseDrawQuery({}), { valid: true, to: undefined });
  assert.deepEqual(parseDrawQuery({ to: "00047" }), { valid: true, to: 47 });
  for (const query of [
    { to: ["47", "27"] },
    { to: "0" },
    { to: "-1" },
    { to: "1.2" },
    { return: "https://example.com" },
    { round: "47", to: "27" },
  ]) {
    assert.equal(parseDrawQuery(query).valid, false);
  }
  assert.equal(listHref(47), "/draw?to=47");
  assert.equal(drawHref(30, 47), "/draw/30?to=47");
  assert.equal(drawHref(30), "/draw/30");
});
test("20회 구간 이동은 고정 상한과 1회·최신 경계를 유지한다", () => {
  assert.deepEqual(rangeNavigation(47, 1247), { previous: 27, next: 67 });
  assert.deepEqual(rangeNavigation(27, 1247), { previous: 7, next: 47 });
  assert.deepEqual(rangeNavigation(7, 1247), { previous: null, next: 27 });
  assert.deepEqual(rangeNavigation(1247, 1247), { previous: 1227, next: null });
  assert.deepEqual(rangeNavigation(47, null), { previous: 27, next: null });
});
