"use client";

import { useMemo } from "react";

import { getCandidatePool, LOTTO_OPTION_IDS } from "../_lib/lotto-conditions";
import { useLottoStore } from "../_store/lotto-store";

export default function CandidateNumbers() {
  const checked = useLottoStore((s) => s.checked);
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

  if (pool.length === 0) return null;

  return (
    <div className="mt-4 space-y-1">
      <p className="text-xs text-zinc-500">현재 조건으로 선택 가능한 번호</p>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
          const enabled = pool.includes(n);
          return (
            <span
              key={n}
              className={[
                "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                enabled
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 text-zinc-300",
              ].join(" ")}
            >
              {n}
            </span>
          );
        })}
      </div>
    </div>
  );
}
