import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { trackLottoEvent } from "../src/app/(home)/_lib/analytics";

const calls: unknown[][] = [];
afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  calls.length = 0;
});
function withAnalytics() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { gtag: (...args: unknown[]) => calls.push(args) },
  });
}
test("성공 이벤트는 이름과 입력값이 섞여도 허용 필드만 전송한다", () => {
  withAnalytics();
  const event = {
    name: "condition_select" as const,
    conditionId: "boss-name-exclusion" as const,
    bossName: "개인입력",
    numbers: [1, 2, 3, 4, 5, 6],
  };
  trackLottoEvent(event);
  assert.deepEqual(calls, [
    ["event", "condition_select", { condition_id: "boss-name-exclusion" }],
  ]);
});
test("완료·회차 펼침 이벤트는 입력값 없이 보내며 복사는 출처만 포함한다", () => {
  withAnalytics();
  trackLottoEvent({ name: "generate_complete" });
  trackLottoEvent({ name: "save_complete" });
  trackLottoEvent({ name: "recent_draws_open" });
  trackLottoEvent({ name: "copy_complete", source: "saved" });
  assert.deepEqual(calls, [
    ["event", "generate_complete", {}],
    ["event", "save_complete", {}],
    ["event", "recent_draws_open", {}],
    ["event", "copy_complete", { source: "saved" }],
  ]);
});
test("런타임에 잘못 들어온 이벤트·조건 ID·복사 출처는 전송하지 않는다", () => {
  withAnalytics();
  for (const event of [
    { name: "개인입력" },
    { name: "condition_select", conditionId: "개인입력" },
    { name: "copy_complete", source: "개인입력" },
  ]) {
    trackLottoEvent(event as Parameters<typeof trackLottoEvent>[0]);
  }
  assert.equal(calls.length, 0);
});
test("서버·GA 미로딩·차단·전송 예외가 제품 동작을 중단하지 않는다", () => {
  assert.doesNotThrow(() => trackLottoEvent({ name: "save_complete" }));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  assert.doesNotThrow(() => trackLottoEvent({ name: "save_complete" }));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      gtag: () => {
        throw new Error("blocked");
      },
    },
  });
  assert.doesNotThrow(() => trackLottoEvent({ name: "save_complete" }));
});
