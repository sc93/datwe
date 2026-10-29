import assert from "node:assert/strict";
import test from "node:test";

import { analyticsPage } from "../src/lib/analytics-page";
test("분석 경로와 제목에 실제 회차·입력 원문을 포함하지 않는다", () => {
  for (const path of ["/draw/600", "/draw/1247"]) {
    const page = analyticsPage(path);
    assert.equal(page.page_path, "/draw/[round]");
    assert.equal(page.page_referrer, "");
    assert.doesNotMatch(JSON.stringify(page), /600|1247/);
  }
  assert.equal(analyticsPage("/draw").page_path, "/draw");
  assert.equal(analyticsPage("/private-input").page_path, "/unknown");
});
