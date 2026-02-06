"use client";

import { create } from "zustand";

import {
  generateLottoNumbers,
  LOTTO_OPTION_IDS,
  type LottoOptionId,
} from "../_lib/lotto-conditions";

type LottoState = {
  checked: Record<LottoOptionId, boolean>;
  numbers: number[] | null;
  error: string | null;
  recentDraws: number[][];
  luckyNumber: number | null;
  resignDay: number | null; // 1-31
  bossName: string | null;
  salaryDay: number | null;
  oddCount: number | null;
};

type LottoActions = {
  setChecked: (id: LottoOptionId, value: boolean) => void;
  setLuckyNumber: (value: number | null) => void;
  setResignDay: (value: number | null) => void;
  setBossName: (value: string | null) => void;
  setSalaryDay: (value: number | null) => void;
  setOddCount: (value: number | null) => void;
  setRecentDraws: (draws: number[][]) => void;
  generate: () => void;
  resetResult: () => void;
};

const initialChecked = LOTTO_OPTION_IDS.reduce(
  (acc, id) => ({ ...acc, [id]: false }),
  {} as Record<LottoOptionId, boolean>,
);

export const useLottoStore = create<LottoState & LottoActions>((set, get) => ({
  checked: initialChecked,
  numbers: null,
  error: null,
  recentDraws: [],
  luckyNumber: null,
  resignDay: null,
  bossName: null,
  salaryDay: null,
  oddCount: null,

  setChecked: (id, value) => {
    set((prev) => {
      const clear: Partial<LottoState> = {};
      if (id === "include-lucky-number" && !value) clear.luckyNumber = null;
      if (id === "resign-date-hash" && !value) clear.resignDay = null;
      if (id === "boss-name-exclusion" && !value) clear.bossName = null;
      if (id === "salary-day-energy" && !value) clear.salaryDay = null;
      if (id === "odd-even-balanced" && !value) clear.oddCount = null;
      return {
        checked: { ...prev.checked, [id]: value },
        numbers: null,
        error: null,
        ...clear,
      };
    });
  },

  setLuckyNumber: (value) =>
    set({ luckyNumber: value, numbers: null, error: null }),
  setResignDay: (value) =>
    set({ resignDay: value, numbers: null, error: null }),
  setBossName: (value) => set({ bossName: value, numbers: null, error: null }),
  setSalaryDay: (value) =>
    set({ salaryDay: value, numbers: null, error: null }),
  setOddCount: (value) => set({ oddCount: value, numbers: null, error: null }),

  resetResult: () => set({ numbers: null, error: null }),

  setRecentDraws: (draws) => set({ recentDraws: draws }),

  generate: () => {
    const {
      checked,
      recentDraws,
      luckyNumber,
      resignDay,
      bossName,
      salaryDay,
      oddCount,
    } = get();
    const selected = new Set<LottoOptionId>(
      LOTTO_OPTION_IDS.filter((id) => checked[id]),
    );
    const result = generateLottoNumbers(selected, recentDraws, {
      luckyNumber,
      resignDay,
      bossName,
      salaryDay,
      oddCount,
    });
    if (result) {
      set({ numbers: result, error: null });
      return;
    }

    set({
      numbers: null,
      error: "조건을 만족하는 번호를 찾지 못했어요. 다시 시도해 주세요.",
    });
  },
}));
