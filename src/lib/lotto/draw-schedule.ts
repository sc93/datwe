import type { LottoDraw } from "./lotto-data";

const WEEK = 7 * 86400000;
// 동행복권 로또6/45 소개: 매주 토요일20:35경. 22시는 수집 목표이지 추첨 경계가 아니다.
// https://www.dhlottery.co.kr/lt645/intro
const FIRST_BOUNDARY = Date.parse("2002-12-07T20:35:00+09:00");
export type DrawSchedule = Readonly<Record<number, string>>;
// 공식 일정 변경 공지가 있으면 해당 회차의 ISO 시각을 기록하고 배포한다.
export const DRAW_SCHEDULE_EXCEPTIONS: DrawSchedule = {};

export function drawBoundary(
  episode: number,
  exceptions = DRAW_SCHEDULE_EXCEPTIONS,
) {
  return exceptions[episode] === undefined
    ? FIRST_BOUNDARY + (episode - 1) * WEEK
    : Date.parse(exceptions[episode]);
}

/** 확인된 공식 최신만 다음 추첨 경계까지 사용한다. DB 조회 시각으로 연장하지 않는다. */
export function latestValidity(
  draw: LottoDraw,
  checkedAt: string | null,
  now: number,
  exceptions = DRAW_SCHEDULE_EXCEPTIONS,
): string | null {
  const boundary = drawBoundary(draw.episode, exceptions);
  const next = drawBoundary(draw.episode + 1, exceptions);
  const checked = Date.parse(checkedAt ?? "");
  const date = new Date(boundary + 9 * 3600000).toISOString().slice(0, 10);
  if (
    draw.drawDate !== date ||
    !Number.isFinite(checked) ||
    checked < boundary ||
    checked > now ||
    now < boundary ||
    now >= next
  )
    return null;
  return new Date(next).toISOString();
}
