import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AnalysisPanel,
  DrawCard,
  RangeNavigation,
} from "../src/app/draw/_components/draw-views";
import { draw } from "./lotto-fixtures";

test("목록 카드는 전체 상세 링크·화살표와 요약만 제공한다", () => {
  const html = renderToStaticMarkup(
    createElement(DrawCard, { draw: draw(47), to: 47 }),
  );
  assert.match(html, /href="\/draw\/47\?to=47"/);
  assert.match(html, /제 47회 당첨번호 상세/);
  assert.match(html, /합계/);
  assert.match(html, /2개 연속/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /<button|상세 보기|공식 결과|구간별|<details/);
});
test("이전 기록 로딩·실패는 기본5개 분석을 유지한다", () => {
  const html = renderToStaticMarkup(
    createElement(AnalysisPanel, {
      draw: draw(6),
      history: null,
      loading: true,
      onRetry: () => {},
    }),
  );
  assert.match(html, /합계 100/);
  assert.match(html, /홀수/);
  assert.match(html, /기록을 확인/);
  assert.doesNotMatch(html, /기록 없음/);
  const failed = renderToStaticMarkup(
    createElement(AnalysisPanel, {
      draw: draw(6),
      history: null,
      loading: false,
      onRetry: () => {},
    }),
  );
  assert.match(failed, /이전 기록 다시 불러오기/);
  assert.match(failed, /판정 불가/);
});
test("목록 구간 링크는 경계를 막고 확정된 문구를 쓴다", () => {
  const html = renderToStaticMarkup(
    createElement(RangeNavigation, { to: 7, latest: 1247 }),
  );
  assert.match(html, /이전 20회/);
  assert.match(html, /최근 20회/);
  assert.match(html, /href="\/draw\?to=27"/);
  assert.doesNotMatch(html, /더 이전|더 최근|to=-/);
});
test("저장된 이전 분석 근거는 확인 시각과 재조회 동작을 표시한다", () => {
  const html = renderToStaticMarkup(
    createElement(AnalysisPanel, {
      draw: draw(2),
      loading: true,
      onRetry: () => {},
      history: {
        status: "stale",
        from: 1,
        to: 1,
        latest: null,
        missingEpisodes: [],
        slots: [
          {
            episode: 1,
            draw: draw(1),
            status: "stale",
            checkedAt: "2026-10-29T00:00:00.000Z",
            sourceUrl: "https://example.test",
            failure: null,
          },
        ],
      },
    }),
  );
  assert.match(html, /이전 기록 일부는 저장된 기록/);
  assert.match(html, /2026\. 10\. 29\. 09:00 확인/);
  assert.match(html, /겹친 번호/);
  assert.match(html, /불러오는 중/);
});
test("상세는 조건별 판정을 계산 근거보다 먼저 보여주고 역사 항목 로딩을 구분한다", () => {
  const html = renderToStaticMarkup(
    createElement(AnalysisPanel, {
      draw: draw(6),
      history: null,
      loading: true,
      onRetry: () => {},
    }),
  );
  const summary = html.slice(
    html.indexOf('aria-label="조건 충족 여부"'),
    html.indexOf("상세 설명"),
  );
  assert.match(summary, /합계 100–170/);
  assert.match(summary, /충족|미충족/);
  assert.match(summary, /홀수 2 · 짝수 4/);
  assert.equal((summary.match(/확인 중/g) ?? []).length, 2);
  assert.ok(html.indexOf("조건 충족 여부") < html.indexOf("상세 설명"));
  assert.ok(html.indexOf("상세 설명") < html.indexOf(" = "));
});
