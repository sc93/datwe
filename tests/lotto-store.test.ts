import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { useLottoStore } from "../src/app/(home)/_store/lotto-store";
import { completeData, draw } from "./lotto-fixtures";

beforeEach(() => {
  mock.method(Date, "now", () => Date.parse("2026-10-28T00:00:00.000Z"));
  useLottoStore.setState(useLottoStore.getInitialState(), true);
});
afterEach(() => mock.restoreAll());
test("검증된 최신순 5회를 생성기의 기존 오름차순 입력으로 연결한다", () => {
  const data = completeData();
  data.draws = data.draws.map((d, i) => ({
    ...d,
    numbers: [1 + i, 10 + i, 20 + i, 30 + i, 40 + i, 45],
    bonus: 7,
  }));
  useLottoStore.getState().setDrawData(data);
  const state = useLottoStore.getState();
  assert.equal(state.canUseRecentFive, true);
  assert.equal(state.canUseCarryOver, true);
  assert.deepEqual(state.recentDraws[0], data.draws[4].numbers);
  assert.deepEqual(state.recentDraws[4], data.draws[0].numbers);
});
test("회차를 아직 불러오지 않았어도 조건 없는 생성은 가능하다", () => {
  useLottoStore.getState().generate();
  const state = useLottoStore.getState();
  assert.equal(state.error, null);
  assert.equal(state.numbers?.length, 6);
  assert.equal(new Set(state.numbers).size, 6);
});
test("누락된 5회 조건은 선택할 수 없지만 확인된 직전 회차 포함은 유지한다", () => {
  useLottoStore.getState().setDrawData({
    ...completeData(),
    status: "partial",
    draws: [draw()],
    missingEpisodes: [1246, 1245, 1244, 1243],
  });
  const state = useLottoStore.getState();
  assert.equal(state.canUseRecentFive, false);
  assert.equal(state.canUseCarryOver, true);
  state.setChecked("recent-5-times-not-appeared", true);
  assert.equal(
    useLottoStore.getState().checked["recent-5-times-not-appeared"],
    false,
  );
  state.setCarryOverNumber(8);
  state.setChecked("carry-over-one", true);
  state.generate();
  assert.equal(useLottoStore.getState().error, null);
  assert.ok(useLottoStore.getState().numbers?.includes(8));
});
test("선택 후 데이터가 부족해지면 조건을 조용히 무시하지 않고 생성을 막는다", () => {
  useLottoStore.getState().setDrawData(completeData());
  useLottoStore.getState().setChecked("recent-5-times-not-appeared", true);
  useLottoStore.getState().setDrawData({
    ...completeData(),
    status: "partial",
    draws: [draw()],
    missingEpisodes: [1246],
  });
  useLottoStore.getState().generate();
  assert.equal(
    useLottoStore.getState().checked["recent-5-times-not-appeared"],
    true,
  );
  assert.equal(useLottoStore.getState().numbers, null);
  assert.match(useLottoStore.getState().error ?? "", /최근 5회/);
  useLottoStore.getState().setChecked("recent-5-times-not-appeared", false);
  useLottoStore.getState().generate();
  assert.equal(useLottoStore.getState().error, null);
});
test("갱신이 지연된 과거 기록은 직전 회차 조건에 쓰지 않는다", () => {
  useLottoStore.getState().setDrawData(completeData());
  useLottoStore.getState().setChecked("carry-over-one", true);
  useLottoStore.getState().setDrawData({ ...completeData(), status: "stale" });
  useLottoStore.getState().generate();
  assert.equal(useLottoStore.getState().canUseCarryOver, false);
  assert.equal(useLottoStore.getState().numbers, null);
  assert.match(useLottoStore.getState().error ?? "", /직전 회차/);
});

test("회차가 바뀌면 이전 이월수를 조용히 포함하지 않고 재선택을 요구한다", () => {
  useLottoStore.getState().setDrawData(completeData());
  useLottoStore.getState().setCarryOverNumber(8);
  useLottoStore.getState().setChecked("carry-over-one", true);
  const newer = {
    ...completeData(),
    latestEpisode: 1248,
    draws: [
      { ...draw(1248), numbers: [1, 2, 3, 4, 5, 6], bonus: 7 },
      ...completeData().draws.slice(0, 4),
    ],
  };
  useLottoStore.getState().setDrawData(newer);
  useLottoStore.getState().generate();
  assert.equal(useLottoStore.getState().numbers, null);
  assert.match(useLottoStore.getState().error ?? "", /다시 선택/);
});

test("화면을 오래 열어두면 데이터 의존 조건은 생성을 막고 일반 생성은 유지한다", () => {
  useLottoStore.getState().setDrawData(completeData());
  useLottoStore.getState().setChecked("recent-5-times-not-appeared", true);
  const state = useLottoStore.getState();
  // 백그라운드 탭의 타이머가 지연돼도 생성 시점에 확인 시각을 다시 검사한다.
  useLottoStore.setState({
    drawData: {
      ...completeData(),
      checkedAt: new Date(Date.now() - 301000).toISOString(),
    },
  });
  state.generate();
  assert.equal(useLottoStore.getState().numbers, null);
  assert.equal(useLottoStore.getState().canUseRecentFive, false);
  useLottoStore.getState().setChecked("recent-5-times-not-appeared", false);
  useLottoStore.getState().generate();
  assert.equal(useLottoStore.getState().error, null);
});

test("서로 모순인 회차 조건의 두 번째 선택을 막고 화면 오류를 제공한다", () => {
  const state = useLottoStore.getState();
  state.setDrawData(completeData());
  state.setChecked("recent-5-times-not-appeared", true);
  state.setChecked("carry-over-one", true);
  assert.equal(useLottoStore.getState().checked["carry-over-one"], false);
  assert.match(useLottoStore.getState().error ?? "", /함께/);
});

test("조건 초기화는 선택과 개인 입력만 지우고 회차 데이터는 보존한다", () => {
  const state = useLottoStore.getState();
  state.setDrawData(completeData());
  state.setLuckyNumber(7);
  state.setChecked("include-lucky-number", true);
  state.resetOptions();
  assert.ok(Object.values(useLottoStore.getState().checked).every((v) => !v));
  assert.equal(useLottoStore.getState().luckyNumber, null);
  assert.equal(useLottoStore.getState().canUseRecentFive, true);
});

test("생성 당시 조건 스냅샷은 이름 대신 파생 번호만 보관한다", () => {
  const state = useLottoStore.getState();
  state.setBossName("테스트이름");
  state.setChecked("boss-name-exclusion", true);
  state.generate();
  const snapshot = useLottoStore.getState().resultContext;
  assert.ok(snapshot);
  assert.equal(snapshot.targetEpisode, null);
  assert.equal(snapshot.conditions[0].id, "boss-name-exclusion");
  assert.equal(typeof snapshot.conditions[0].value, "number");
  assert.doesNotMatch(JSON.stringify(snapshot), /테스트이름/);
});
test("대상 회차는 생성 당시 확인된 최신 회차 기준이며 갱신돼도 바뀌지 않는다", () => {
  const state = useLottoStore.getState();
  state.setDrawData(completeData());
  state.generate();
  assert.equal(useLottoStore.getState().resultContext?.targetEpisode, 1248);
  state.setDrawData({ ...completeData(), status: "stale" });
  assert.equal(useLottoStore.getState().resultContext?.targetEpisode, 1248);
  state.generate();
  assert.equal(useLottoStore.getState().resultContext?.targetEpisode, null);
});
