import { LOTTO_OPTION_IDS, type LottoOptionId } from "./lotto-conditions";

type LottoEvent =
  | { name: "generate_complete" | "save_complete" | "recent_draws_open" }
  | { name: "copy_complete"; source: "result" | "saved" }
  | { name: "condition_select"; conditionId: LottoOptionId };

declare global {
  interface Window {
    gtag?: (
      command: "event",
      name: string,
      parameters: Record<string, string>,
    ) => void;
  }
}

/** 입력 원문과 번호를 받지 않으며, 런타임에서도 허용한 필드만 새로 구성한다. */
export function trackLottoEvent(event: LottoEvent): void {
  if (typeof window === "undefined") return;
  const parameters: Record<string, string> = {};
  switch (event.name) {
    case "condition_select":
      if (!LOTTO_OPTION_IDS.includes(event.conditionId)) return;
      parameters.condition_id = event.conditionId;
      break;
    case "copy_complete":
      if (event.source !== "result" && event.source !== "saved") return;
      parameters.source = event.source;
      break;
    case "generate_complete":
    case "save_complete":
    case "recent_draws_open":
      break;
    default:
      return;
  }
  try {
    window.gtag?.("event", event.name, parameters);
  } catch {
    // 분석 차단이나 외부 스크립트 실패가 생성·저장·복사를 막지 않는다.
  }
}
