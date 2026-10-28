import assert from "node:assert/strict";
import test from "node:test";

import { getDrawAvailability, parseDrawResponse } from "../src/lib/lotto-data";
import { completeData, draw, rawDraw, response } from "./lotto-fixtures";

test("실제 응답 필드에서 회차·날짜·본번호·보너스를 분리한다", () => {
  assert.deepEqual(parseDrawResponse(response()), draw());
  assert.deepEqual(
    parseDrawResponse({
      data: { list: [{ ...rawDraw(), tm1WnNo: 45, tm6WnNo: 8 }] },
    })?.numbers,
    [8, 14, 21, 22, 42, 45],
  );
});
test("범위·정수·중복·보너스·날짜·회차가 잘못된 응답을 거부한다", () => {
  for (const patch of [
    { tm1WnNo: 0 },
    { tm1WnNo: 46 },
    { tm1WnNo: 1.5 },
    { tm1WnNo: "8" },
    { tm1WnNo: 14 },
    { bnsWnNo: 8 },
    { bnsWnNo: 46 },
    { bnsWnNo: 2.5 },
    { ltRflYmd: "20260230" },
    { ltRflYmd: "20261301" },
    { ltRflYmd: null },
    { ltEpsd: 0 },
    { ltEpsd: 1.5 },
  ])
    assert.equal(
      parseDrawResponse({ data: { list: [{ ...rawDraw(), ...patch }] } }),
      null,
      JSON.stringify(patch),
    );
  assert.equal(parseDrawResponse(response(1246), 1247), null);
});
test("잘못된 JSON 구조·빈 목록·중복 회차를 거부하고 최신 행의 손상을 숨기지 않는다", () => {
  for (const value of [null, {}, "html", { data: { list: [] } }])
    assert.equal(parseDrawResponse(value), null);
  assert.equal(
    parseDrawResponse({ data: { list: [rawDraw(), rawDraw()] } }),
    null,
  );
  assert.equal(
    parseDrawResponse({
      data: { list: [{ ...rawDraw(), bnsWnNo: 8 }, rawDraw(1246)] },
    }),
    null,
  );
});
test("정확히 연속된 최신 5회일 때만 최근 5회 제외를 사용할 수 있다", () => {
  assert.deepEqual(getDrawAvailability(completeData()), {
    recentFive: true,
    carryOver: true,
  });
  for (const draws of [
    [draw(), draw(1246)],
    [draw(), draw(1246), draw(1245), draw(1244), draw(1242)],
    [draw(), draw(1246), draw(1245), draw(1244), draw(1244)],
  ])
    assert.equal(
      getDrawAvailability({ ...completeData(), draws }).recentFive,
      false,
    );
});
test("오래된 캐시는 최신 조건에 쓰지 않으며 부분 응답은 확인된 직전 회차만 허용한다", () => {
  assert.deepEqual(
    getDrawAvailability({ ...completeData(), status: "stale" }),
    { recentFive: false, carryOver: false },
  );
  assert.deepEqual(
    getDrawAvailability({
      ...completeData(),
      status: "partial",
      draws: [draw()],
    }),
    { recentFive: false, carryOver: true },
  );
  assert.deepEqual(
    getDrawAvailability({
      ...completeData(),
      status: "partial",
      draws: [draw(1246)],
    }),
    { recentFive: false, carryOver: false },
  );
  assert.deepEqual(
    getDrawAvailability({
      ...completeData(),
      status: "unavailable",
      draws: [],
    }),
    { recentFive: false, carryOver: false },
  );
});
