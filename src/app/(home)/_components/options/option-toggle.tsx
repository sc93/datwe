"use client";

import { type LottoOptionId } from "../../_lib/lotto-conditions";
import { useLottoStore } from "../../_store/lotto-store";
import OptionCheckbox from "../option-checkbox";

type Props = {
  id: LottoOptionId;
  label: string;
};

export default function OptionToggle({ id, label }: Props) {
  const checked = useLottoStore((s) => s.checked[id]);
  const setChecked = useLottoStore((s) => s.setChecked);

  return (
    <OptionCheckbox
      id={id}
      label={label}
      checked={checked}
      onCheckedChange={(v) => setChecked(id, v)}
    />
  );
}
