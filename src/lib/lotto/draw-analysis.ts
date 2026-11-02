import type { LottoDraw } from "./lotto-data";
import {
  countNumberSections,
  countOddNumbers,
  findLinePatterns,
  getConsecutiveRuns,
  intersectNumbers,
  isSumInRange,
  isValidMainNumbers,
  type LineViolation,
  NUMBER_SECTIONS,
  sumNumbers,
  unionNumbers,
} from "./lotto-rules";

export type DrawSummary = {
  sum: number;
  oddCount: number;
  evenCount: number;
  maxConsecutiveLength: number;
  consecutiveRuns: number[][];
  consecutiveLabel: string;
};
export type AnalysisStatus = "met" | "unmet" | "observed" | "unavailable";
export type AnalysisItem<T, S extends AnalysisStatus = AnalysisStatus> = {
  status: S;
  value: T | null;
  basisEpisodes: number[];
  rule: string;
  reason: "insufficient-history" | "missing-history" | "invalid-history" | null;
};
type HistoryItem = AnalysisItem<{
  matchedNumbers: number[];
  matchedCount: number;
}> & {
  missingEpisodes: number[];
  invalidEpisodes: number[];
};
export type DrawAnalysis = {
  episode: number;
  summary: DrawSummary;
  conditions: {
    sum: AnalysisItem<{ total: number; min: number; max: number }>;
    oddEven: AnalysisItem<{ oddCount: number; evenCount: number }, "observed">;
    consecutive: AnalysisItem<{ maxLength: number; runs: number[][] }>;
    sections: AnalysisItem<{ counts: number[]; missingSections: string[] }>;
    marking: AnalysisItem<{ violations: LineViolation[] }>;
    previousFive: HistoryItem;
    previousOne: HistoryItem;
  };
  ignoredEpisodes: number[];
};

function validDraw(draw: LottoDraw): boolean {
  if (
    !draw ||
    !Number.isSafeInteger(draw.episode) ||
    draw.episode < 1 ||
    !Array.isArray(draw.numbers) ||
    !isValidMainNumbers(draw.numbers) ||
    !Number.isInteger(draw.bonus) ||
    draw.bonus < 1 ||
    draw.bonus > 45 ||
    draw.numbers.includes(draw.bonus) ||
    typeof draw.drawDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(draw.drawDate)
  )
    return false;
  const [year, month, day] = draw.drawDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** 목록에서는 본번호 요약만 계산한다. 번호대별 개수와 7항목 판정은 상세에만 제공한다. */
export function summarizeDraw(target: LottoDraw): DrawSummary | null {
  if (!validDraw(target)) return null;
  const runs = getConsecutiveRuns(target.numbers);
  const maxLength = Math.max(1, ...runs.map((run) => run.length));
  const odd = countOddNumbers(target.numbers);
  return {
    sum: sumNumbers(target.numbers),
    oddCount: odd,
    evenCount: 6 - odd,
    maxConsecutiveLength: maxLength,
    consecutiveRuns: runs,
    consecutiveLabel: maxLength > 1 ? `${maxLength}개 연속` : "연속 번호 없음",
  };
}

/** 시각·네트워크·개인 입력에 의존하지 않으며 누락을 인접 회차로 채우지 않는다. */
export function analyzeDraw(
  target: LottoDraw,
  history: readonly LottoDraw[] = [],
): DrawAnalysis | null {
  const summary = summarizeDraw(target);
  if (!summary) return null;
  const n = target.episode;
  const base = <T, S extends AnalysisStatus>(
    value: T,
    status: S,
    rule: string,
  ): AnalysisItem<T, S> => ({
    value,
    status,
    rule,
    basisEpisodes: [n],
    reason: null,
  });
  const counts = countNumberSections(target.numbers);
  const violations = findLinePatterns(target.numbers);
  const byEpisode = new Map<number, LottoDraw[]>();
  const ignored = new Set<number>();
  for (const draw of history) {
    if (!draw || !Number.isSafeInteger(draw.episode) || draw.episode < 1)
      continue;
    if (draw.episode >= n || draw.episode < n - 5) {
      ignored.add(draw.episode);
      continue;
    }
    byEpisode.set(draw.episode, [...(byEpisode.get(draw.episode) ?? []), draw]);
  }

  function previous(count: 1 | 5): HistoryItem {
    const basisEpisodes = Array.from(
      { length: Math.min(count, n - 1) },
      (_, i) => n - i - 1,
    );
    const rule =
      count === 5
        ? "이전 5회 본번호와 겹친 번호 0개"
        : "직전 회차 본번호와 겹친 번호 정확히 1개";
    const missingEpisodes: number[] = [],
      invalidEpisodes: number[] = [],
      draws: LottoDraw[] = [];
    for (const ep of basisEpisodes) {
      const records = byEpisode.get(ep) ?? [];
      if (!records.length) missingEpisodes.push(ep);
      else if (records.length !== 1 || !validDraw(records[0]))
        invalidEpisodes.push(ep);
      else draws.push(records[0]);
    }
    const reason =
      n <= count
        ? "insufficient-history"
        : invalidEpisodes.length
          ? "invalid-history"
          : missingEpisodes.length
            ? "missing-history"
            : null;
    const matched = reason
      ? []
      : intersectNumbers(
          target.numbers,
          unionNumbers(draws.map((draw) => draw.numbers)),
        );
    return {
      basisEpisodes,
      rule,
      missingEpisodes,
      invalidEpisodes,
      reason,
      value: reason
        ? null
        : { matchedNumbers: matched, matchedCount: matched.length },
      status: reason
        ? "unavailable"
        : matched.length === (count === 5 ? 0 : 1)
          ? "met"
          : "unmet",
    };
  }

  return {
    episode: n,
    summary,
    ignoredEpisodes: [...ignored].sort((a, b) => a - b),
    conditions: {
      sum: base(
        { total: summary.sum, min: 100, max: 170 },
        isSumInRange(target.numbers) ? "met" : "unmet",
        "본번호 합계 100 이상 170 이하 · 양 끝 포함",
      ),
      oddEven: base(
        { oddCount: summary.oddCount, evenCount: summary.evenCount },
        "observed",
        "실제 홀수·짝수 개수 · 특정 비율의 충족 여부를 판정하지 않음",
      ),
      consecutive: base(
        {
          maxLength: summary.maxConsecutiveLength,
          runs: summary.consecutiveRuns,
        },
        summary.maxConsecutiveLength < 3 ? "met" : "unmet",
        "연속 정수 3개 이상 없음 · 2연번 허용",
      ),
      sections: base(
        {
          counts,
          missingSections: NUMBER_SECTIONS.filter((_, i) => counts[i] === 0),
        },
        counts.every((c) => c > 0) ? "met" : "unmet",
        "1–9 / 10–19 / 20–29 / 30–39 / 40–45 구간마다 최소 1개",
      ),
      marking: base(
        { violations },
        violations.length ? "unmet" : "met",
        "1부터 가로로 채운 5열×9행의 가로·세로·45도 양방향 대각선 위 세 점 없음 · 떨어진 점 포함 · 실제 용지 규격 아님",
      ),
      previousFive: previous(5),
      previousOne: previous(1),
    },
  };
}
