import { getStrokeCount } from "./stroke-count";

/**
 * 로또 번호 생성 시 적용할 수 있는 조건 ID
 */
export const LOTTO_OPTION_IDS = [
  "recent-5-times-not-appeared",
  "sum-between-100-and-170",
  "include-lucky-number",
  "resign-date-hash",
  "boss-name-exclusion",
  "salary-day-energy",
  "odd-even-balanced",
  "no-serial-numbers",
  "carry-over-one",
  "balanced-section",
  "diagonal-pattern",
] as const;

export type LottoOptionId = (typeof LOTTO_OPTION_IDS)[number];

/** 조건별 추가 입력값 */
export type LottoOptionInputs = {
  luckyNumber: number | null;
  resignDay: number | null; // 1-31, 희망 퇴사일(일) 포함
  bossName: string | null;
  salaryDay: number | null; // 1-31
  oddCount: number | null; // 0-6 (홀수 개수)
};

/** 최근 5회차에 한 번이라도 나온 번호 집합 */
function getAppearedInRecentDraws(recentDraws: number[][]): Set<number> {
  const set = new Set<number>();
  for (const draw of recentDraws) {
    for (const n of draw) set.add(n);
  }
  return set;
}

/** 1~45 중 조건에 맞는 풀에서 중복 없이 6개 뽑기 (오름차순) */
function pick6FromPool(pool: number[], random = Math.random): number[] {
  const shuffled = [...pool].sort(() => random() - 0.5);
  return shuffled.slice(0, 6).sort((a, b) => a - b);
}

/** 고정 번호들 + 풀에서 나머지 채우기 */
function pickWithFixed(
  pool: number[],
  fixed: number[],
  random = Math.random,
): number[] {
  const set = new Set(fixed);
  const rest = pool.filter((n) => !set.has(n));
  if (rest.length < 6 - fixed.length) return [];
  const need = 6 - fixed.length;
  const picked = [...rest].sort(() => random() - 0.5).slice(0, need);
  return [...fixed, ...picked].sort((a, b) => a - b);
}

/** 직전 회차에서 1개 + 풀에서 5개 (이월수 1개 포함) */
function pick6WithCarryOne(
  pool: number[],
  lastDraw: number[],
  random = Math.random,
): number[] {
  const inPool = lastDraw.filter((n) => pool.includes(n));
  if (inPool.length === 0) return [];
  const carry = inPool[Math.floor(random() * inPool.length)];
  const rest = pool.filter((n) => n !== carry);
  if (rest.length < 5) return [];
  const five = [...rest].sort(() => random() - 0.5).slice(0, 5);
  return [...five, carry].sort((a, b) => a - b);
}

const MIN_SUM = 100;
const MAX_SUM = 169; // 170 미만
const MAX_ATTEMPTS = 8000;

/** 3연번 이상 있는지 */
function has3Consecutive(nums: number[]): boolean {
  const sorted = [...nums].sort((a, b) => a - b);
  for (let i = 0; i <= sorted.length - 3; i++) {
    if (sorted[i + 1] === sorted[i] + 1 && sorted[i + 2] === sorted[i] + 2)
      return true;
  }
  return false;
}

/** 번호 → 5x9 그리드 위치 (row 0-8, col 0-4) */
function toGrid(n: number): { row: number; col: number } {
  const i = n - 1;
  return { row: Math.floor(i / 5), col: i % 5 };
}

/** 대각선/직선 3개 이상 있는지 (로또 용지 5열 x 9행) */
function hasLinePattern(nums: number[]): boolean {
  const points = nums.map(toGrid);
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      for (let k = j + 1; k < points.length; k++) {
        const [a, b, c] = [points[i], points[j], points[k]];
        const sameRow = a.row === b.row && b.row === c.row;
        const sameCol = a.col === b.col && b.col === c.col;
        const diag1 =
          a.row - a.col === b.row - b.col && b.row - b.col === c.row - c.col;
        const diag2 =
          a.row + a.col === b.row + b.col && b.row + b.col === c.row + c.col;
        if (sameRow || sameCol || diag1 || diag2) return true;
      }
    }
  }
  return false;
}

/** 번호대별 1개 이상 (1-9, 10-19, 20-29, 30-39, 40-45) */
function isBalancedSection(nums: number[]): boolean {
  const sections = [0, 0, 0, 0, 0]; // 1-9, 10-19, 20-29, 30-39, 40-45
  for (const n of nums) {
    if (n <= 9) sections[0]++;
    else if (n <= 19) sections[1]++;
    else if (n <= 29) sections[2]++;
    else if (n <= 39) sections[3]++;
    else sections[4]++;
  }
  return sections.every((c) => c >= 1);
}

/** 홀수 개수가 정확히 k개인지 */
function oddCountMatch(nums: number[], k: number): boolean {
  const odds = nums.filter((n) => n % 2 === 1).length;
  return odds === k;
}

/**
 * 선택된 조건을 반영해 로또 번호 6개 생성.
 */
export function generateLottoNumbers(
  selectedOptions: Set<LottoOptionId>,
  recentDraws: number[][] = [],
  inputs: LottoOptionInputs = {
    luckyNumber: null,
    resignDay: null,
    bossName: null,
    salaryDay: null,
    oddCount: null,
  },
): number[] | null {
  let pool: number[] = Array.from({ length: 45 }, (_, i) => i + 1);

  // 최근 5회차 미출현
  if (
    selectedOptions.has("recent-5-times-not-appeared") &&
    recentDraws.length > 0
  ) {
    const appeared = getAppearedInRecentDraws(recentDraws);
    pool = pool.filter((n) => !appeared.has(n));
    if (pool.length < 6) return null;
  }

  // 상사 이름 획수 제외: getStrokeCount로 제외할 번호 1개 (1~45)
  if (selectedOptions.has("boss-name-exclusion") && inputs.bossName?.trim()) {
    let exclude = getStrokeCount(inputs.bossName.trim());
    while (exclude > 45) exclude -= 45;
    if (exclude < 1) exclude = 1;
    pool = pool.filter((n) => n !== exclude);
    if (pool.length < 6) return null;
  }

  const needLucky =
    selectedOptions.has("include-lucky-number") &&
    inputs.luckyNumber != null &&
    inputs.luckyNumber >= 1 &&
    inputs.luckyNumber <= 45 &&
    pool.includes(inputs.luckyNumber);

  const needCarryOne =
    selectedOptions.has("carry-over-one") &&
    recentDraws.length > 0 &&
    (() => {
      const last = recentDraws[recentDraws.length - 1];
      return last.some((n) => pool.includes(n));
    })();

  const needSalary =
    selectedOptions.has("salary-day-energy") &&
    inputs.salaryDay != null &&
    inputs.salaryDay >= 1 &&
    inputs.salaryDay <= 31;
  const salaryNumber = needSalary
    ? Math.min(45, Math.max(1, Math.round((inputs.salaryDay! * 45) / 31)))
    : null;
  const needSalaryInPool =
    needSalary && salaryNumber != null && pool.includes(salaryNumber);

  // 희망 퇴사일 포함: 1~31 입력값을 그대로 포함
  const needResignDay =
    selectedOptions.has("resign-date-hash") &&
    inputs.resignDay != null &&
    inputs.resignDay >= 1 &&
    inputs.resignDay <= 31 &&
    pool.includes(inputs.resignDay);

  const random = Math.random;

  const needSumCondition = selectedOptions.has("sum-between-100-and-170");
  const needOddCount =
    selectedOptions.has("odd-even-balanced") &&
    inputs.oddCount != null &&
    inputs.oddCount >= 0 &&
    inputs.oddCount <= 6;
  const needNoSerial = selectedOptions.has("no-serial-numbers");
  const needBalanced = selectedOptions.has("balanced-section");
  const needNoDiagonal = selectedOptions.has("diagonal-pattern");

  const lastDraw =
    recentDraws.length > 0 ? recentDraws[recentDraws.length - 1] : [];

  const fixedNumbers: number[] = [];
  if (needLucky) fixedNumbers.push(inputs.luckyNumber!);
  if (
    needSalaryInPool &&
    salaryNumber != null &&
    !fixedNumbers.includes(salaryNumber)
  )
    fixedNumbers.push(salaryNumber);
  if (
    needResignDay &&
    inputs.resignDay != null &&
    !fixedNumbers.includes(inputs.resignDay)
  )
    fixedNumbers.push(inputs.resignDay);

  const pick = (): number[] => {
    if (needCarryOne && lastDraw.length > 0) {
      return pick6WithCarryOne(pool, lastDraw, random);
    }
    if (fixedNumbers.length > 0) {
      return pickWithFixed(pool, fixedNumbers, random);
    }
    return pick6FromPool(pool, random);
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const numbers = pick();
    if (numbers.length === 0) return null;

    if (needOddCount && !oddCountMatch(numbers, inputs.oddCount!)) continue;
    if (needNoSerial && has3Consecutive(numbers)) continue;
    if (needBalanced && !isBalancedSection(numbers)) continue;
    if (needNoDiagonal && hasLinePattern(numbers)) continue;
    if (needSumCondition) {
      const sum = numbers.reduce((a, b) => a + b, 0);
      if (sum < MIN_SUM || sum > MAX_SUM) continue;
    }

    return numbers;
  }

  return null;
}
