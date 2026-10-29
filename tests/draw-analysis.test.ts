import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_INPUTS,
  type LottoOptionId,
  matchesLottoConditions,
} from "../src/app/(home)/_lib/lotto-conditions";
import { analyzeDraw, summarizeDraw } from "../src/lib/draw-analysis";
import type { LottoDraw } from "../src/lib/lotto-data";

function draw(
  episode: number,
  numbers = [1, 8, 15, 22, 34, 41],
  bonus = 45,
): LottoDraw {
  return { episode, drawDate: "2020-01-04", numbers, bonus };
}
const history = () => [
  draw(5, [1, 2, 3, 4, 5, 6]),
  draw(4, [7, 9, 10, 11, 12, 13]),
  draw(3, [14, 16, 17, 18, 19, 20]),
  draw(2, [21, 23, 24, 25, 26, 27]),
  draw(1, [28, 29, 30, 31, 32, 33]),
];

test("목록 요약은 본번호만으로 합계·홀짝·연속 번호를 반환하고 입력을 바꾸지 않는다", () => {
  const target = draw(6, [41, 34, 22, 15, 8, 1]);
  const original = structuredClone(target);
  assert.deepEqual(summarizeDraw(target), {
    sum: 121,
    oddCount: 3,
    evenCount: 3,
    maxConsecutiveLength: 1,
    consecutiveRuns: [],
    consecutiveLabel: "연속 번호 없음",
  });
  assert.deepEqual(target, original);
  const serial = summarizeDraw(draw(6, [9, 10, 11, 20, 30, 40]));
  assert.equal(serial?.consecutiveLabel, "3개 연속");
  assert.deepEqual(serial?.consecutiveRuns, [[9, 10, 11]]);
});

test("합계99·100·170·171을 경계 포함 여부에 맞게 판정한다", () => {
  for (const [numbers, sum, status] of [
    [[1, 2, 3, 19, 30, 44], 99, "unmet"],
    [[1, 2, 3, 20, 30, 44], 100, "met"],
    [[20, 21, 22, 23, 39, 45], 170, "met"],
    [[20, 21, 22, 24, 39, 45], 171, "unmet"],
  ] as const) {
    const result = analyzeDraw(draw(6, [...numbers], 4));
    assert.equal(result?.conditions.sum.status, status);
    assert.equal(result?.conditions.sum.value?.total, sum);
    assert.equal(result?.summary.sum, sum);
    assert.deepEqual(result?.conditions.sum.basisEpisodes, [6]);
  }
});

test("홀수0~6개 모두 실제 개수만 관찰값으로 제공한다", () => {
  for (let odd = 0; odd <= 6; odd++) {
    const numbers = [1, 3, 5, 7, 9, 11]
      .slice(0, odd)
      .concat([2, 4, 6, 8, 10, 12].slice(0, 6 - odd));
    const result = analyzeDraw(draw(6, numbers));
    assert.equal(result?.conditions.oddEven.status, "observed");
    assert.deepEqual(result?.conditions.oddEven.value, {
      oddCount: odd,
      evenCount: 6 - odd,
    });
  }
});

test("2연번은 허용하고 3개 이상·긴 연번의 실제 구간과 최대 길이를 설명한다", () => {
  for (const [numbers, status, length, runs] of [
    [[1, 2, 8, 20, 30, 40], "met", 2, [[1, 2]]],
    [[1, 2, 3, 20, 30, 40], "unmet", 3, [[1, 2, 3]]],
    [[1, 2, 3, 4, 5, 6], "unmet", 6, [[1, 2, 3, 4, 5, 6]]],
    [
      [1, 2, 10, 11, 30, 40],
      "met",
      2,
      [
        [1, 2],
        [10, 11],
      ],
    ],
  ] as const) {
    const result = analyzeDraw(draw(6, [...numbers]));
    assert.equal(result?.conditions.consecutive.status, status);
    assert.equal(result?.summary.maxConsecutiveLength, length);
    assert.deepEqual(result?.conditions.consecutive.value?.runs, runs);
    assert.deepEqual(result?.summary.consecutiveRuns, runs);
  }
});

test("상세 구간은 9/10/19/20/29/30/39/40/45 경계를 정확히 나눈다", () => {
  for (const [numbers, counts, missing, status] of [
    [[9, 10, 19, 20, 30, 40], [1, 2, 1, 1, 1], [], "met"],
    [[10, 19, 20, 29, 30, 39], [0, 2, 2, 2, 0], ["1–9", "40–45"], "unmet"],
    [[1, 9, 20, 29, 40, 45], [2, 0, 2, 0, 2], ["10–19", "30–39"], "unmet"],
  ] as const) {
    const item = analyzeDraw(draw(6, [...numbers], 2))?.conditions.sections;
    assert.equal(item?.status, status);
    assert.deepEqual(item?.value?.counts, counts);
    assert.deepEqual(item?.value?.missingSections, missing);
  }
});

test("떨어진 가로·세로·양방향45도 대각선의 위반 세 점과 방향을 반환한다", () => {
  for (const [numbers, triple, direction] of [
    [[1, 3, 5, 22, 34, 45], [1, 3, 5], "horizontal"],
    [[1, 11, 21, 28, 39, 45], [1, 11, 21], "vertical"],
    [[1, 13, 25, 27, 34, 45], [1, 13, 25], "diagonal-down"],
    [[5, 13, 21, 28, 39, 45], [5, 13, 21], "diagonal-up"],
  ] as const) {
    const item = analyzeDraw(draw(6, [...numbers], 2))?.conditions.marking;
    assert.equal(item?.status, "unmet");
    assert.ok(
      item?.value?.violations.some(
        (v) =>
          v.direction === direction &&
          JSON.stringify(v.numbers) === JSON.stringify(triple),
      ),
    );
  }
  assert.equal(analyzeDraw(draw(6))?.conditions.marking.status, "met");
});

test("이전5회 제외와 직전1개를 독립 판정하고 보너스는 비교하지 않는다", () => {
  const result = analyzeDraw(draw(6), history())!;
  assert.equal(result.conditions.previousFive.status, "unmet");
  assert.deepEqual(result.conditions.previousFive.value?.matchedNumbers, [1]);
  assert.deepEqual(
    result.conditions.previousFive.basisEpisodes,
    [5, 4, 3, 2, 1],
  );
  assert.equal(result.conditions.previousOne.status, "met");
  assert.deepEqual(result.conditions.previousOne.value?.matchedNumbers, [1]);
  for (const [numbers, count, status] of [
    [[7, 8, 15, 22, 34, 41], 0, "unmet"],
    [[1, 8, 15, 22, 34, 41], 1, "met"],
    [[1, 2, 15, 22, 34, 41], 2, "unmet"],
  ] as const) {
    const item = analyzeDraw(draw(6, [...numbers]), history())!.conditions
      .previousOne;
    assert.equal(item.value?.matchedCount, count);
    assert.equal(item.status, status);
  }
  const bonusOnly = analyzeDraw(
    draw(6, [8, 15, 22, 34, 41, 45], 1),
    history().map((d) => ({ ...d, bonus: 45 })),
  )!;
  assert.equal(bonusOnly.conditions.previousFive.status, "met");
  assert.equal(bonusOnly.conditions.previousOne.value?.matchedCount, 0);
});

test("1·5·6회 경계를 구분하고 이전 기록이 부족해도 본번호 분석을 제공한다", () => {
  const first = analyzeDraw(draw(1))!;
  assert.equal(first.conditions.previousFive.status, "unavailable");
  assert.equal(first.conditions.previousOne.status, "unavailable");
  assert.equal(first.conditions.previousOne.reason, "insufficient-history");
  const fifth = analyzeDraw(
    draw(5),
    history().filter((d) => d.episode < 5),
  )!;
  assert.equal(fifth.conditions.previousFive.reason, "insufficient-history");
  assert.notEqual(fifth.conditions.previousOne.status, "unavailable");
  const sixth = analyzeDraw(draw(6))!;
  assert.equal(sixth.conditions.sum.status, "met");
  assert.equal(sixth.conditions.previousFive.reason, "missing-history");
  assert.deepEqual(
    sixth.conditions.previousFive.missingEpisodes,
    [5, 4, 3, 2, 1],
  );
});

test("역순은 회차로 정렬해 판단하고 누락·중복·손상은 해당 의존 항목에만 영향을 준다", () => {
  assert.deepEqual(
    analyzeDraw(draw(6), history()),
    analyzeDraw(draw(6), history().reverse()),
  );
  const missing = analyzeDraw(
    draw(6),
    history().filter((d) => d.episode !== 3),
  )!;
  assert.equal(missing.conditions.previousFive.reason, "missing-history");
  assert.deepEqual(missing.conditions.previousFive.missingEpisodes, [3]);
  assert.equal(missing.conditions.previousOne.status, "met");
  const duplicate = analyzeDraw(draw(6), [...history(), history()[2]])!;
  assert.equal(duplicate.conditions.previousFive.reason, "invalid-history");
  assert.deepEqual(duplicate.conditions.previousFive.invalidEpisodes, [3]);
  assert.equal(duplicate.conditions.previousOne.status, "met");
  const invalid = history();
  invalid[0] = { ...invalid[0], numbers: [1, 1, 3, 4, 5, 6] };
  const result = analyzeDraw(draw(6), invalid)!;
  assert.equal(result.conditions.previousOne.reason, "invalid-history");
  assert.equal(result.conditions.previousFive.reason, "invalid-history");
});

test("대상·미래·이전5회 밖 기록을 근거에 혼입하지 않는다", () => {
  const base = analyzeDraw(draw(10), [
    draw(9),
    draw(8),
    draw(7),
    draw(6),
    draw(5),
  ])!;
  const mixed = analyzeDraw(draw(10), [
    draw(10),
    draw(11),
    draw(4),
    draw(9),
    draw(8),
    draw(7),
    draw(6),
    draw(5),
  ])!;
  assert.deepEqual(mixed.conditions, base.conditions);
  assert.deepEqual(mixed.ignoredEpisodes, [4, 10, 11]);
});

test("대상 회차·날짜·본번호·보너스 손상은 요약과 전체 분석을 만들지 않는다", () => {
  for (const target of [
    draw(0),
    draw(1, [1, 1, 3, 4, 5, 6]),
    draw(1, [1, 2, 3, 4, 5, 46]),
    draw(1, [1, 2, 3, 4, 5]),
    draw(1, [1, 2, 3, 4, 5, 6], 6),
    { ...draw(1), drawDate: "2020-02-30" },
  ]) {
    assert.equal(summarizeDraw(target), null);
    assert.equal(analyzeDraw(target, history()), null);
  }
});

test("비어 있는 배열 슬롯을 여섯 번째 본번호로 인정하지 않는다", () => {
  const numbers = [1, 8, 15, 22, 34, 41];
  delete numbers[5];
  assert.equal(summarizeDraw(draw(6, numbers)), null);
  assert.equal(
    matchesLottoConditions(numbers, new Set(), EMPTY_INPUTS, []),
    false,
  );
});

test("생성기와 상세의 공통 조건 결과가 일치한다", () => {
  const pairs: [
    keyof NonNullable<ReturnType<typeof analyzeDraw>>["conditions"],
    LottoOptionId,
  ][] = [
    ["sum", "sum-between-100-and-170"],
    ["consecutive", "no-serial-numbers"],
    ["sections", "balanced-section"],
    ["marking", "diagonal-pattern"],
    ["previousOne", "carry-over-one"],
  ];
  for (const numbers of [
    [1, 8, 15, 22, 34, 41],
    [1, 2, 3, 4, 5, 6],
    [9, 10, 19, 20, 30, 40],
    [5, 13, 21, 28, 39, 45],
  ]) {
    const result = analyzeDraw(draw(6, numbers, 44), history())!;
    for (const [id, option] of pairs) {
      assert.equal(
        result.conditions[id].status === "met",
        matchesLottoConditions(
          numbers,
          new Set([option]),
          EMPTY_INPUTS,
          history()[0].numbers,
        ),
        id,
      );
    }
  }
});
