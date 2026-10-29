import {
  countOddNumbers,
  hasLinePattern,
  hasThreeConsecutive as has3Consecutive,
  intersectNumbers,
  isBalancedSection,
  isSumInRange,
  isValidMainNumbers,
  unionNumbers as getAppearedInRecentDraws,
} from "@/lib/lotto-rules";

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
  carryOverNumber: number | null;
};

export const EMPTY_INPUTS: LottoOptionInputs = {
  luckyNumber: null,
  resignDay: null,
  bossName: null,
  salaryDay: null,
  oddCount: null,
  carryOverNumber: null,
};

export function getNameNumber(name: string): number {
  return Math.max(1, ((getStrokeCount(name.trim()) - 1) % 45) + 1);
}

type Failure = {
  status: "invalid" | "impossible" | "exhausted";
  message: string;
};
export type LottoResult = { status: "success"; numbers: number[] } | Failure;
type CandidatePoolBase = {
  pool: number[];
  lastDraw: number[];
  fixed: number[];
};
const integerIn = (n: number | null, max: number, min = 1): n is number =>
  n !== null && Number.isInteger(n) && n >= min && n <= max;

function prepare(
  selected: Set<LottoOptionId>,
  draws: number[][],
  inputs: LottoOptionInputs,
): CandidatePoolBase | Failure {
  const recent = selected.has("recent-5-times-not-appeared");
  const carry = selected.has("carry-over-one");
  const invalid = (message: string): Failure => ({
    status: "invalid",
    message,
  });
  if (recent && carry)
    return invalid(
      "최근 5회 제외와 직전 본번호 1개 포함은 함께 선택할 수 없어요. 하나를 해제해 주세요.",
    );
  const validDraw = isValidMainNumbers;
  if (recent && (draws.length !== 5 || !draws.every(validDraw)))
    return invalid("정확한 최근 5회 본번호가 필요해요.");
  const lastDraw = draws.at(-1) ?? [];
  if (carry && !validDraw(lastDraw))
    return invalid("직전 회차 본번호를 확인해 주세요.");
  const fixed: number[] = [];
  for (const [id, value, max, label] of [
    ["include-lucky-number", inputs.luckyNumber, 45, "행운 번호"],
    ["resign-date-hash", inputs.resignDay, 31, "퇴사일"],
    ["salary-day-energy", inputs.salaryDay, 31, "월급날"],
  ] as const) {
    if (!selected.has(id)) continue;
    if (!integerIn(value, max))
      return invalid(`${label}를 1~${max} 정수로 입력해 주세요.`);
    fixed.push(
      id === "salary-day-energy" ? Math.round((value * 45) / 31) : value,
    );
  }
  if (selected.has("boss-name-exclusion")) {
    if (!inputs.bossName?.trim()) return invalid("이름을 입력해 주세요.");
    fixed.push(getNameNumber(inputs.bossName));
  }
  if (selected.has("odd-even-balanced") && !integerIn(inputs.oddCount, 6, 0))
    return invalid(
      "홀수 개수를 0~6 정수로 입력해 주세요. 짝수 개수와 합해 6개가 됩니다.",
    );
  if (carry && inputs.carryOverNumber !== null) {
    if (
      !integerIn(inputs.carryOverNumber, 45) ||
      !lastDraw.includes(inputs.carryOverNumber)
    )
      return invalid("직전 본번호 중에서 이월수를 다시 선택해 주세요.");
    fixed.push(inputs.carryOverNumber);
  }
  const appeared = recent ? getAppearedInRecentDraws(draws) : new Set<number>();
  if (fixed.some((n) => appeared.has(n)))
    return invalid(
      "고정 번호가 최근 5회 제외 번호와 겹쳐요. 고정 번호를 바꾸거나 제외 조건을 해제해 주세요.",
    );
  const pool = Array.from({ length: 45 }, (_, i) => i + 1).filter(
    (n) => !appeared.has(n),
  );
  return { pool, lastDraw, fixed: [...new Set(fixed)].sort((a, b) => a - b) };
}

export function getCandidatePool(
  selected: Set<LottoOptionId>,
  draws: number[][] = [],
  inputs = EMPTY_INPUTS,
): CandidatePoolBase | null {
  const result = prepare(selected, draws, inputs);
  return "status" in result ? null : result;
}

/** 5열×9행에서 떨어진 세 점도 같은 직선이면 제한한다. */
export function matchesLottoConditions(
  numbers: number[],
  selected: Set<LottoOptionId>,
  inputs: LottoOptionInputs,
  lastDraw: number[],
): boolean {
  if (!isValidMainNumbers(numbers)) return false;
  return (
    (!selected.has("sum-between-100-and-170") || isSumInRange(numbers)) &&
    (!selected.has("odd-even-balanced") ||
      countOddNumbers(numbers) === inputs.oddCount) &&
    (!selected.has("no-serial-numbers") || !has3Consecutive(numbers)) &&
    (!selected.has("balanced-section") || isBalancedSection(numbers)) &&
    (!selected.has("diagonal-pattern") || !hasLinePattern(numbers)) &&
    (!selected.has("carry-over-one") ||
      intersectNumbers(numbers, lastDraw).length === 1)
  );
}

/** Fisher–Yates: 각 단계에서 남은 요소를 균등하게 선택한다. */
function shuffled(pool: number[], random: () => number): number[] {
  const result = [...pool];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateLottoResult(
  selected: Set<LottoOptionId>,
  draws: number[][] = [],
  inputs = EMPTY_INPUTS,
  {
    random = Math.random,
    maxAttempts = 8000,
  }: { random?: () => number; maxAttempts?: number } = {},
): LottoResult {
  const base = prepare(selected, draws, inputs);
  if ("status" in base) return base;
  const { pool, fixed, lastDraw } = base;
  const impossible = (): Failure => ({
    status: "impossible",
    message:
      "선택한 조건으로는 조합을 만들 수 없어요. 고정 번호나 조합 조건을 변경해 주세요.",
  });
  const carry = selected.has("carry-over-one");
  const fixedCarry = fixed.filter((n) => lastDraw.includes(n));
  if (carry && fixedCarry.length > 1) return impossible();
  const rest = pool.filter(
    (n) => !fixed.includes(n) && (!carry || !lastDraw.includes(n)),
  );
  const carryCandidates =
    carry && fixedCarry.length === 0
      ? lastDraw.filter((n) => pool.includes(n))
      : [];
  const needsCarry = carry && fixedCarry.length === 0;
  const need = 6 - fixed.length - Number(needsCarry);
  if (need < 0 || rest.length < need || (needsCarry && !carryCandidates.length))
    return impossible();
  const allCandidates = [...rest, ...carryCandidates].sort((a, b) => a - b);
  const slots = 6 - fixed.length;
  const fixedSum = fixed.reduce((a, b) => a + b, 0);
  if (
    selected.has("sum-between-100-and-170") &&
    (fixedSum + allCandidates.slice(0, slots).reduce((a, b) => a + b, 0) >
      170 ||
      fixedSum + allCandidates.slice(-slots).reduce((a, b) => a + b, 0) < 100)
  )
    return impossible();
  if (selected.has("odd-even-balanced")) {
    const oddNeeded =
      inputs.oddCount! - fixed.filter((n) => n % 2 === 1).length;
    if (
      oddNeeded < 0 ||
      oddNeeded > slots ||
      allCandidates.filter((n) => n % 2 === 1).length < oddNeeded ||
      allCandidates.filter((n) => n % 2 === 0).length < slots - oddNeeded
    )
      return impossible();
  }
  if (selected.has("no-serial-numbers") && has3Consecutive(fixed))
    return impossible();
  if (selected.has("diagonal-pattern") && hasLinePattern(fixed))
    return impossible();
  if (selected.has("balanced-section")) {
    const section = (n: number) => (n < 10 ? 0 : Math.floor(n / 10));
    const missing = [0, 1, 2, 3, 4].filter(
      (s) => !fixed.some((n) => section(n) === s),
    );
    if (
      missing.length > slots ||
      missing.some((s) => !allCandidates.some((n) => section(n) === s))
    )
      return impossible();
  }
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const autoCarry = needsCarry
      ? [carryCandidates[Math.floor(random() * carryCandidates.length)]]
      : [];
    const numbers = [
      ...fixed,
      ...autoCarry,
      ...shuffled(rest, random).slice(0, need),
    ].sort((a, b) => a - b);
    if (matchesLottoConditions(numbers, selected, inputs, lastDraw))
      return { status: "success", numbers };
  }
  return {
    status: "exhausted",
    message:
      "탐색 횟수 안에 조건에 맞는 번호를 찾지 못했어요. 불가능하다는 뜻은 아니에요. 다시 생성하거나 조건을 줄여 주세요.",
  };
}

export function generateLottoNumbers(
  selected: Set<LottoOptionId>,
  draws: number[][] = [],
  inputs = EMPTY_INPUTS,
): number[] | null {
  const result = generateLottoResult(selected, draws, inputs);
  return result.status === "success" ? result.numbers : null;
}
