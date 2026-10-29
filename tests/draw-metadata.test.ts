import assert from "node:assert/strict";
import test from "node:test";

import {
  drawDetailMetadata,
  drawListMetadata,
  invalidDrawMetadata,
} from "../src/lib/draw-metadata";
import type { DrawRangeResult,DrawResult } from "../src/lib/draw-reader";
import { draw } from "./lotto-fixtures";
const target: DrawResult = {
  episode: 600,
  draw: draw(600),
  status: "fresh",
  checkedAt: "2026-10-29T00:00:00Z",
  sourceUrl: "https://example.test",
  failure: null,
};
test("공유 정보는 회차를 유지하고 복귀 쿼리는 canonical에서 제외한다", () => {
  const m = drawDetailMetadata({ target, latest: target }, 600);
  assert.equal(m.alternates?.canonical, "https://datwe.vercel.app/draw/600");
  assert.match(String(m.description), /600/);
  assert.equal(m.openGraph?.url, "https://datwe.vercel.app/draw/600");
  const range: DrawRangeResult = {
    status: "fresh",
    from: 28,
    to: 47,
    latest: target,
    slots: [],
    missingEpisodes: [],
  };
  assert.equal(
    drawListMetadata(range, 47).alternates?.canonical,
    "https://datwe.vercel.app/draw?to=47",
  );
});
test("잘못된 주소와 실패 기록은 정상 결과 소개나 색인 허용으로 표현하지 않는다", () => {
  const m = drawDetailMetadata(
    {
      target: { ...target, status: "unavailable", draw: null },
      latest: target,
    },
    600,
  );
  assert.deepEqual(m.robots, { index: false, follow: true });
  assert.doesNotMatch(String(m.description), /7개|제 600회/);
  assert.deepEqual(invalidDrawMetadata().robots, {
    index: false,
    follow: true,
  });
});
