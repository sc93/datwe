import type { ConditionSnapshot } from "./saved-numbers";

export function conditionLabel(condition: ConditionSnapshot): string {
  const labels = {
    "include-lucky-number": "행운 번호",
    "boss-name-exclusion": "이름 번호",
    "resign-date-hash": "퇴사일",
    "salary-day-energy": "월급날 번호",
    "recent-5-times-not-appeared": "최근 5회 제외",
    "carry-over-one": "직전 본번호 1개",
    "sum-between-100-and-170": "합계 100~170",
    "odd-even-balanced": "홀짝 비율",
    "no-serial-numbers": "3연번 제한",
    "balanced-section": "구간별 분포",
    "diagonal-pattern": "직선·대각선 제한",
  };
  if (condition.id === "odd-even-balanced" && condition.value !== null)
    return `홀 ${condition.value} · 짝 ${6 - condition.value}`;
  return `${labels[condition.id]}${condition.value !== null ? ` ${condition.value}` : ""}`;
}
