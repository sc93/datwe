"use client";

import { getStrokeCount } from "../../_lib/stroke-count";
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

  const luckyNumber = useLottoStore((s) => s.luckyNumber);
  const bossName = useLottoStore((s) => s.bossName);
  const carryOverNumber = useLottoStore((s) => s.carryOverNumber);
  const recentDraws = useLottoStore((s) => s.recentDraws);

  const handleCheckedChange = (v: boolean) => {
    if (id === "recent-5-times-not-appeared" && v) {
      const appeared = new Set<number>();
      for (const draw of recentDraws) {
        for (const n of draw) appeared.add(n);
      }

      let bossNum: number | null = null;
      if (bossName && bossName.trim().length > 0) {
        let n = getStrokeCount(bossName.trim());
        while (n > 45) n -= 45;
        if (n < 1) n = 1;
        bossNum = n;
      }

      const fixedNumbers = [
        luckyNumber ?? null,
        bossNum,
        carryOverNumber ?? null,
      ].filter((n): n is number => n != null);

      const hasConflict = fixedNumbers.some((n) => appeared.has(n));
      if (hasConflict) {
        if (typeof window !== "undefined") {
          window.alert(
            "현재 선택된 행운 번호/이름 획수/이월수와 함께는 최근 5회 미출현 조건을 사용할 수 없어요.",
          );
        }
        return;
      }
    }

    setChecked(id, v);
  };

  return (
    <OptionCheckbox
      id={id}
      label={label}
      checked={checked}
      onCheckedChange={handleCheckedChange}
    />
  );
}
