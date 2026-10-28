"use client";

import { useLottoStore } from "../../_store/lotto-store";
import OptionCheckbox from "../option-checkbox";

export default function RecentFiveOption() {
  const id = "recent-5-times-not-appeared" as const;
  const label = "최근 5회차 번호 제외";
  const checked = useLottoStore((s) => s.checked[id]);
  const available = useLottoStore((s) => s.canUseRecentFive);
  const setChecked = useLottoStore((s) => s.setChecked);

  return (
    <OptionCheckbox
      id={id}
      label={label}
      checked={checked}
      onCheckedChange={(v) => setChecked(id, v)}
      disabled={!available && !checked}
      valueLabel={!available ? "연속 5회 확인 필요" : null}
    />
  );
}
