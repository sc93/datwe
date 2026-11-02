/** 생성과 과거 분석이 함께 사용하는 순수 본번호 규칙. 부분 고정번호도 계산할 수 있다. */
export function isValidMainNumbers(numbers: readonly number[]): boolean {
  return (
    numbers.length === 6 &&
    new Set(numbers).size === 6 &&
    Array.from(numbers).every((n) => Number.isInteger(n) && n >= 1 && n <= 45)
  );
}

export const sumNumbers = (numbers: readonly number[]) =>
  numbers.reduce((sum, n) => sum + n, 0);
export const countOddNumbers = (numbers: readonly number[]) =>
  numbers.filter((n) => n % 2 === 1).length;
export const isSumInRange = (numbers: readonly number[]) => {
  const sum = sumNumbers(numbers);
  return sum >= 100 && sum <= 170;
};
export const NUMBER_SECTIONS = [
  "1–9",
  "10–19",
  "20–29",
  "30–39",
  "40–45",
] as const;
export function countNumberSections(numbers: readonly number[]): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const n of numbers) counts[n < 10 ? 0 : Math.floor(n / 10)]++;
  return counts;
}
export const isBalancedSection = (numbers: readonly number[]) =>
  countNumberSections(numbers).every((count) => count >= 1);

/** 길이 2 이상인 연속 구간만 반환하며 입력 순서를 바꾸지 않는다. */
export function getConsecutiveRuns(numbers: readonly number[]): number[][] {
  const sorted = [...numbers].sort((a, b) => a - b),
    runs: number[][] = [];
  let run: number[] = [];
  for (const n of sorted) {
    if (run.length && n !== run[run.length - 1] + 1) {
      if (run.length >= 2) runs.push(run);
      run = [];
    }
    run.push(n);
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}
export const hasThreeConsecutive = (numbers: readonly number[]) =>
  getConsecutiveRuns(numbers).some((run) => run.length >= 3);

export type LineViolation = {
  direction: "horizontal" | "vertical" | "diagonal-down" | "diagonal-up";
  numbers: [number, number, number];
};
/** 1부터 가로로 채운 5열×9행. 실제 용지 규격이 아니며 떨어진 세 점도 포함한다. */
export function findLinePatterns(numbers: readonly number[]): LineViolation[] {
  const sorted = [...numbers].sort((a, b) => a - b),
    violations: LineViolation[] = [];
  const point = (n: number) => ({
    row: Math.floor((n - 1) / 5),
    col: (n - 1) % 5,
  });
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length; j++)
      for (let k = j + 1; k < sorted.length; k++) {
        const triple: [number, number, number] = [
          sorted[i],
          sorted[j],
          sorted[k],
        ];
        const [a, b, c] = triple.map(point);
        let direction: LineViolation["direction"] | null = null;
        if (a.row === b.row && b.row === c.row) direction = "horizontal";
        else if (a.col === b.col && b.col === c.col) direction = "vertical";
        else if (
          a.row - a.col === b.row - b.col &&
          b.row - b.col === c.row - c.col
        )
          direction = "diagonal-down";
        else if (
          a.row + a.col === b.row + b.col &&
          b.row + b.col === c.row + c.col
        )
          direction = "diagonal-up";
        if (direction) violations.push({ numbers: triple, direction });
      }
  return violations;
}
export const hasLinePattern = (numbers: readonly number[]) =>
  findLinePatterns(numbers).length > 0;
export function unionNumbers(
  draws: readonly (readonly number[])[],
): Set<number> {
  return new Set(draws.flat());
}
export function intersectNumbers(
  numbers: readonly number[],
  other: Iterable<number>,
): number[] {
  const pool = new Set(other);
  return numbers.filter((n) => pool.has(n)).sort((a, b) => a - b);
}
