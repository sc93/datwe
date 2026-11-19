"use client";

import { useLottoStore } from "../../_store/lotto-store";
import OptionCheckbox from "../option-checkbox";

export default function RecentFiveOption() {
  const id = "recent-5-times-not-appeared" as const;
  const label = "최근 5회차 번호 제외";
  const checked = useLottoStore((s) => s.checked[id]);
  const available = useLottoStore((s) => s.canUseRecentFive);
  const setChecked = useLottoStore((s) => s.setChecked);

  function getValueLabel() {
    if (!available) {
      if (checked) {
        return "기록 확인 필요 · 해제 가능";
      }
      return "최신 연속 5회 확인 필요";
    }
    return null;
  }
  return (
    <OptionCheckbox
      id={id}
      label={label}
      checked={checked}
      onCheckedChange={async (v) => {
        if (v) await useLottoStore.getState().refreshDrawData();
        setChecked(id, v);
      }}
      disabled={!available && !checked}
      valueLabel={getValueLabel()}
    />
  );
}
