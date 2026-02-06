"use client";

import { useLottoStore } from "../../_store/lotto-store";
import OptionCheckbox from "../option-checkbox";

export default function RecentFiveOption() {
  const id = "recent-5-times-not-appeared" as const;
  const label = "최근 5회차 번호 제외";
  const checked = useLottoStore((s) => s.checked[id]);
  const recentDraws = useLottoStore((s) => s.recentDraws);
  const setChecked = useLottoStore((s) => s.setChecked);

  const valueLabel =
    recentDraws.length > 0
      ? [...new Set(recentDraws.flat())].sort((a, b) => a - b).join(", ")
      : null;
  return (
    <OptionCheckbox
      id={id}
      label={label}
      checked={checked}
      onCheckedChange={(v) => setChecked(id, v)}
      // valueLabel={valueLabel}
    />
  );
}
