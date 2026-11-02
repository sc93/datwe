import assert from "node:assert/strict";
import test from "node:test";

import { drawBoundary, latestValidity } from "../src/lib/draw-schedule";
import { draw } from "./lotto-fixtures";

test("한국시간 토요일20:35 경계 전까지 이전 최신을 사용하고 이후 제한한다", () => {
  assert.equal(
    new Date(drawBoundary(1248)).toISOString(),
    "2026-10-31T11:35:00.000Z",
  );
  const checked = "2026-10-24T13:00:00Z";
  assert.equal(
    latestValidity(draw(), checked, Date.parse("2026-10-31T11:34:59Z")),
    "2026-10-31T11:35:00.000Z",
  );
  assert.equal(
    latestValidity(draw(), checked, Date.parse("2026-10-31T11:35:00Z")),
    null,
  );
  assert.equal(
    latestValidity(
      draw(1248),
      "2026-10-31T13:00:00Z",
      Date.parse("2026-10-31T13:00:01Z"),
    ),
    "2026-11-07T11:35:00.000Z",
  );
});

test("최신은 회차·추첨일·실제 원천 확인시각을 함께 검증하며 일정 예외를 적용한다", () => {
  const now = Date.parse("2026-10-31T12:00:00Z");
  assert.equal(latestValidity(draw(1248), "2026-10-31T10:00:00Z", now), null);
  assert.equal(latestValidity(draw(1248), "2026-11-01T00:00:00Z", now), null);
  assert.equal(
    latestValidity({ ...draw(), episode: 1248 }, "2026-10-31T11:40:00Z", now),
    null,
  );
  const exceptions = { 1248: "2026-10-31T13:00:00Z" };
  assert.equal(
    latestValidity(draw(), "2026-10-24T13:00:00Z", now, exceptions),
    "2026-10-31T13:00:00.000Z",
  );
  assert.equal(
    latestValidity(draw(1248), "2026-10-31T12:00:00Z", now, exceptions),
    null,
  );
});
