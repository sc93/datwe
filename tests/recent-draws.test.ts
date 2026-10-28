import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  RecentDrawsLoading,
  RecentDrawsView,
} from "../src/app/(home)/_components/recent-draws-view";
import { completeData, draw } from "./lotto-fixtures";

function render(data = completeData(), isRefreshing = false) {
  return renderToStaticMarkup(
    createElement(RecentDrawsView, { data, isRefreshing, onRefresh: () => {} }),
  );
}
test("메인에 최신 회차의 날짜·본번호6개·보너스를 구분하고 최근5회를 제공한다", () => {
  const html = render();
  assert.match(html, /최근 당첨번호/);
  assert.match(html, /제 1247회/);
  assert.match(html, /datetime="2026-10-24"/i);
  assert.match(html, /aria-label="본번호"/);
  assert.match(html, /aria-label="보너스 번호"/);
  assert.match(html, />24<\/span>/);
  assert.match(html, /지난 회차 보기/);
  assert.ok(html.indexOf("제 1247회") < html.indexOf("제 1246회"));
  assert.match(html, /https:\/\/www\.dhlottery\.co\.kr\/lt645\/result/);
});
test("갱신 지연 상태는 최신 확인 대신 저장된 기록과 마지막 확인 시각을 표시한다", () => {
  const html = render({ ...completeData(), status: "stale" });
  assert.match(html, /저장된 기록/);
  assert.match(html, /갱신이 지연/);
  assert.match(html, /마지막 확인/);
  assert.doesNotMatch(html, /최신 확인 완료/);
  assert.match(html, /제 1247회/);
});
test("부분 누락은 확인된 회차만 표시하고 누락된 최신 회차를 과거 번호로 대체하지 않는다", () => {
  const data = {
    ...completeData(),
    status: "partial" as const,
    draws: [draw(1246)],
    missingEpisodes: [1247, 1245, 1244, 1243],
  };
  const html = render(data);
  assert.match(html, /일부 회차/);
  assert.match(html, /최신 회차의 번호를 확인하지 못했어요/);
  assert.match(html, /제 1246회/);
  assert.doesNotMatch(html, /data-slot="latest-draw"/);
  assert.match(html, /1247/);
});
test("전체 실패에도 재시도·일반 생성 안내를 남기고 번호를 꾸며내지 않는다", () => {
  const html = render({
    status: "unavailable",
    latestEpisode: null,
    checkedAt: null,
    draws: [],
    missingEpisodes: [],
  });
  assert.match(html, /당첨번호를 불러오지 못했어요/);
  assert.match(html, /다시 불러오기/);
  assert.match(html, /일반 번호 생성/);
  assert.doesNotMatch(html, /data-slot="latest-draw"/);
  assert.doesNotMatch(html, /<details/);
});
test("첫 로딩과 재시도 중 상태를 알리고 새로고침 중 기존 기록을 유지한다", () => {
  const loading = renderToStaticMarkup(createElement(RecentDrawsLoading));
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /불러오고 있어요/);
  const refreshing = render(completeData(), true);
  assert.match(refreshing, /aria-busy="true"/);
  assert.match(refreshing, /불러오는 중/);
  assert.match(refreshing, /disabled/);
  assert.match(refreshing, /제 1247회/);
});
