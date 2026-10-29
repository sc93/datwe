import type { DrawRangeResult } from "./draw-reader";

/** 같은 구간에서 재조회에 실패한 회차는 마지막 정상 스냅샷을 보존한다. */
export function mergeDrawRange(
  previous: DrawRangeResult,
  next: DrawRangeResult,
): DrawRangeResult {
  if (previous.to !== next.to || previous.from !== next.from) return next;
  const oldSlots = new Map(previous.slots.map((slot) => [slot.episode, slot]));
  let retained = false;
  const slots = next.slots.map((slot) => {
    const old = oldSlots.get(slot.episode);
    if (slot.draw || !old?.draw) return slot;
    retained = true;
    return { ...old, status: "stale" as const };
  });
  return retained ? { ...next, slots, status: "partial" } : next;
}
