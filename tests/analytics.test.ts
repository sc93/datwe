import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { trackLottoEvent } from "../src/app/(home)/_lib/analytics";

const calls: unknown[][] = [];
const originalEnv = { ...process.env };
const page = {
  page_path: "/draw/[round]",
  page_title: "회차 당첨번호 상세",
  page_location: "https://datwe.vercel.app/draw/[round]",
  page_referrer: "",
};
afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  calls.length = 0;
  Object.assign(process.env, originalEnv);
  if (originalEnv.NEXT_PUBLIC_GA_ENHANCED_MEASUREMENT_DISABLED === undefined)
    delete process.env.NEXT_PUBLIC_GA_ENHANCED_MEASUREMENT_DISABLED;
});
function withAnalytics() {
  Object.assign(process.env, {
    NODE_ENV: "production",
    NEXT_PUBLIC_GA_ENHANCED_MEASUREMENT_DISABLED: "true",
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { origin: "https://datwe.vercel.app", pathname: "/draw/600" },
      gtag: (...args: unknown[]) => calls.push(args),
    },
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
    [
      "event",
      "condition_select",
      { condition_id: "boss-name-exclusion", ...page },
    ],
  ]);
});
test("완료·회차 탐색 이벤트는 입력값 없이 보내며 복사는 출처만 포함한다", () => {
  withAnalytics();
  trackLottoEvent({ name: "generate_complete" });
  trackLottoEvent({ name: "save_complete" });
  trackLottoEvent({ name: "draw_list_open" });
  trackLottoEvent({ name: "copy_complete", source: "saved" });
  assert.deepEqual(calls, [
    ["event", "generate_complete", { ...page }],
    ["event", "save_complete", { ...page }],
    ["event", "draw_list_open", { ...page }],
    ["event", "copy_complete", { source: "saved", ...page }],
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
    value: { location: { origin: "https://datwe.vercel.app", pathname: "/" } },
  });
  assert.doesNotThrow(() => trackLottoEvent({ name: "save_complete" }));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { origin: "https://datwe.vercel.app", pathname: "/" },
      gtag: () => {
        throw new Error("blocked");
      },
    },
  });
  assert.doesNotThrow(() => trackLottoEvent({ name: "save_complete" }));
});
test("자동 수집 중지 확인 전·로컬·미리보기는 이벤트를 전송하지 않는다", () => {
  withAnalytics();
  delete process.env.NEXT_PUBLIC_GA_ENHANCED_MEASUREMENT_DISABLED;
  trackLottoEvent({ name: "draw_detail_view" });
  assert.equal(calls.length, 0);
  process.env.NEXT_PUBLIC_GA_ENHANCED_MEASUREMENT_DISABLED = "true";
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { origin: "https://preview.vercel.app", pathname: "/draw/600" },
      gtag: (...args: unknown[]) => calls.push(args),
    },
  });
  trackLottoEvent({ name: "draw_detail_view" });
  assert.equal(calls.length, 0);
});
test("제거된 펼침·원문 필드는 전송하지 않는다", () => {
  withAnalytics();
  trackLottoEvent({ name: "recent_draws_open" } as never);
  trackLottoEvent({
    name: "draw_search_complete",
    query: "600",
    page_location: "https://example.test/private",
    numbers: [1, 2],
  } as never);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(JSON.stringify(calls), /600|private|numbers|query/);
});
