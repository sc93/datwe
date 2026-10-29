import assert from "node:assert/strict";
import test from "node:test";

import { consumeSearchVisit, expectSearchVisit } from "../src/lib/draw-visit";
test("현재 정상 상세의 재검색은 즉시 완료하며 다음 방문에 이월하지 않는다", () => {
  assert.equal(expectSearchVisit(600, 600), true);
  assert.equal(consumeSearchVisit(600), false);
});
test("이동 검색은 대상 확인 후 한 번만 완료하고 다른 방문에 남지 않는다", () => {
  assert.equal(expectSearchVisit(600), false);
  assert.equal(consumeSearchVisit(600), true);
  assert.equal(consumeSearchVisit(600), false);
  expectSearchVisit(600);
  assert.equal(consumeSearchVisit(601), false);
  assert.equal(consumeSearchVisit(600), false);
});
