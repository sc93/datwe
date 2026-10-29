"use client";

import { useMemo } from "react";

import { getCandidatePool, LOTTO_OPTION_IDS } from "../_lib/lotto-conditions";
import { useLottoStore } from "../_store/lotto-store";

export default function CandidateNumbers() {
  const checked = useLottoStore((s) => s.checked);
  const canUseRecentFive = useLottoStore((s) => s.canUseRecentFive);
  const canUseCarryOver = useLottoStore((s) => s.canUseCarryOver);
  const recentDraws = useLottoStore((s) => s.recentDraws);
  const luckyNumber = useLottoStore((s) => s.luckyNumber);
  const resignDay = useLottoStore((s) => s.resignDay);
  const bossName = useLottoStore((s) => s.bossName);
  const salaryDay = useLottoStore((s) => s.salaryDay);
  const oddCount = useLottoStore((s) => s.oddCount);
  const carryOverNumber = useLottoStore((s) => s.carryOverNumber);

  const selected = useMemo(
    () => new Set(LOTTO_OPTION_IDS.filter((id) => checked[id])),
    [checked],
  );

  const pool = useMemo(() => {
    const base = getCandidatePool(selected, recentDraws, {
      luckyNumber,
      resignDay,
      bossName,
      salaryDay,
      oddCount,
      carryOverNumber,
    });
    return base?.pool ?? [];
  }, [
    selected,
    recentDraws,
    luckyNumber,
    resignDay,
    bossName,
    salaryDay,
    oddCount,
    carryOverNumber,
  ]);

  if (
    pool.length === 0 ||
    (checked["recent-5-times-not-appeared"] && !canUseRecentFive) ||
    (checked["carry-over-one"] && !canUseCarryOver)
  )
    return null;

  return (
    <details className="mt-4 space-y-2 rounded-xl border p-3">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">
        번호 후보 보기
      </summary>
      <p className="text-muted-foreground text-xs">
        개별 번호 후보예요. 합계·분포 등 최종 조합 가능성을 보장하지 않아요.
        초록색 번호가 후보예요.
      </p>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
          const enabled = pool.includes(n);
          return (
            <span
              key={n}
              className={[
                "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                enabled
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              ].join(" ")}
            >
              {n}
            </span>
          );
        })}
      </div>
    </details>
  );
}
