import assert from "node:assert/strict";
import { test } from "node:test";

import {
  generateLottoNumbers,
  generateLottoResult,
  getCandidatePool,
  type LottoOptionId,
  type LottoOptionInputs,
  matchesLottoConditions,
} from "../src/app/(home)/_lib/lotto-conditions";

const empty: LottoOptionInputs = {
  luckyNumber: null,
  resignDay: null,
  bossName: null,
  salaryDay: null,
  oddCount: null,
  carryOverNumber: null,
};
const selected = (...ids: LottoOptionId[]) => new Set(ids);
const draws = Array.from({ length: 5 }, (_, i) =>
  Array.from({ length: 6 }, (_, j) => i * 6 + j + 1),
);

test("합계 100과 170은 포함하고 99와 171은 제외한다", () => {
  for (const [numbers, expected] of [
    [[1, 2, 3, 20, 30, 44], true],
    [[20, 21, 22, 23, 39, 45], true],
    [[1, 2, 3, 19, 30, 44], false],
    [[20, 21, 22, 24, 39, 45], false],
  ] as const) {
    assert.equal(
      matchesLottoConditions(
        [...numbers],
        selected("sum-between-100-and-170"),
        empty,
        [],
      ),
      expected,
    );
  }
});

test("제외된 고정 번호를 후보에 복원하지 않고 충돌을 반환한다", () => {
  assert.equal(
    getCandidatePool(
      selected("recent-5-times-not-appeared", "include-lucky-number"),
      draws,
      { ...empty, luckyNumber: 1 },
    ),
    null,
  );
  const result = generateLottoResult(
    selected("recent-5-times-not-appeared", "include-lucky-number"),
    draws,
    { ...empty, luckyNumber: 1 },
  );
  assert.equal(result.status, "invalid");
});

test("최근 5회 제외와 직전 1개를 동시에 적용하지 않는다", () => {
  assert.equal(
    generateLottoResult(
      selected("recent-5-times-not-appeared", "carry-over-one"),
      draws,
      empty,
    ).status,
    "invalid",
  );
});

test("자동·수동 이월수는 직전에서 정확히 1개이고 고정 번호를 보존한다", () => {
  for (const carryOverNumber of [null, 26]) {
    for (let i = 0; i < 50; i++) {
      const numbers = generateLottoNumbers(
        selected("carry-over-one", "include-lucky-number"),
        draws,
        { ...empty, luckyNumber: 40, carryOverNumber },
      );
      assert.ok(numbers);
      assert.ok(numbers.includes(40));
      assert.equal(numbers.filter((n) => draws[4].includes(n)).length, 1);
      if (carryOverNumber) assert.ok(numbers.includes(carryOverNumber));
    }
  }
});

test("입력 누락·소수·잘못된 이월수와 5회 미만 기록을 무시하지 않는다", () => {
  for (const luckyNumber of [null, 1.5, 46]) {
    assert.equal(
      generateLottoResult(selected("include-lucky-number"), [], {
        ...empty,
        luckyNumber,
      }).status,
      "invalid",
    );
  }
  assert.equal(
    generateLottoResult(selected("carry-over-one"), draws, {
      ...empty,
      carryOverNumber: 1,
    }).status,
    "invalid",
  );
  assert.equal(
    generateLottoResult(
      selected("recent-5-times-not-appeared"),
      draws.slice(1),
      empty,
    ).status,
    "invalid",
  );
});

test("확정된 불가능 조건과 탐색 횟수 소진을 구분한다", () => {
  assert.equal(
    generateLottoResult(
      selected("include-lucky-number", "odd-even-balanced"),
      [],
      { ...empty, luckyNumber: 1, oddCount: 0 },
    ).status,
    "impossible",
  );
  assert.equal(
    generateLottoResult(selected("sum-between-100-and-170"), [], empty, {
      maxAttempts: 0,
    }).status,
    "exhausted",
  );
});

test("5열×9행의 가로·세로·양쪽 45도 대각선은 떨어진 세 점도 제한한다", () => {
  for (const numbers of [
    [1, 3, 5, 22, 34, 45],
    [1, 11, 21, 28, 39, 45],
    [1, 13, 25, 27, 34, 45],
    [5, 13, 21, 28, 39, 45],
  ]) {
    assert.equal(
      matchesLottoConditions(numbers, selected("diagonal-pattern"), empty, []),
      false,
    );
  }
  assert.equal(
    matchesLottoConditions(
      [1, 8, 15, 22, 34, 41],
      selected("diagonal-pattern"),
      empty,
      [],
    ),
    true,
  );
});

test("구간 경계·홀짝 합계·3연번 규칙을 적용한다", () => {
  assert.equal(
    matchesLottoConditions(
      [9, 10, 19, 20, 30, 40],
      selected("balanced-section"),
      empty,
      [],
    ),
    true,
  );
  assert.equal(
    matchesLottoConditions(
      [10, 19, 20, 29, 30, 40],
      selected("balanced-section"),
      empty,
      [],
    ),
    false,
  );
  assert.equal(
    matchesLottoConditions(
      [1, 2, 3, 20, 30, 40],
      selected("no-serial-numbers"),
      empty,
      [],
    ),
    false,
  );
  assert.equal(
    matchesLottoConditions(
      [1, 2, 4, 20, 30, 40],
      selected("no-serial-numbers"),
      empty,
      [],
    ),
    true,
  );
  for (const oddCount of [0, 6]) {
    const numbers = oddCount === 0 ? [2, 4, 6, 8, 10, 12] : [1, 3, 5, 7, 9, 11];
    assert.equal(
      matchesLottoConditions(
        numbers,
        selected("odd-even-balanced"),
        { ...empty, oddCount },
        [],
      ),
      true,
    );
  }
});

test("셔플은 입력 풀을 보존하고 주입된 난수로 재현 가능한 결과를 생성한다", () => {
  let calls = 0;
  const result = generateLottoResult(selected(), [], empty, {
    random: () => {
      calls++;
      return 0;
    },
  });
  assert.equal(calls, 44);
  assert.deepEqual(result, { status: "success", numbers: [2, 3, 4, 5, 6, 7] });
});

test("복합 조건 생성 결과는 고유 번호 6개이며 모든 선택 조건을 만족한다", () => {
  const options = selected(
    "include-lucky-number",
    "sum-between-100-and-170",
    "odd-even-balanced",
    "no-serial-numbers",
    "balanced-section",
    "diagonal-pattern",
  );
  const inputs = { ...empty, luckyNumber: 7, oddCount: 3 };
  for (let i = 0; i < 20; i++) {
    const result = generateLottoResult(options, [], inputs);
    assert.equal(result.status, "success");
    if (result.status !== "success") continue;
    assert.ok(result.numbers.includes(7));
    assert.ok(matchesLottoConditions(result.numbers, options, inputs, []));
  }
});
