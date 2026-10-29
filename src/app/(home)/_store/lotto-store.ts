"use client";

import { create } from "zustand";

import {
  getDrawAvailability,
  getLottoDataAtTime,
  type LottoData,
} from "@/lib/lotto-data";

import {
  EMPTY_INPUTS,
  generateLottoResult,
  getNameNumber,
  LOTTO_OPTION_IDS,
  type LottoOptionId,
} from "../_lib/lotto-conditions";
import type { SavedNumber } from "../_lib/saved-numbers";

type LottoState = {
  resultContext: Pick<SavedNumber, "targetEpisode" | "conditions"> | null;
  checked: Record<LottoOptionId, boolean>;
  numbers: number[] | null;
  error: string | null;
  recentDraws: number[][];
  drawData: LottoData | null;
  canUseRecentFive: boolean;
  canUseCarryOver: boolean;
  luckyNumber: number | null;
  resignDay: number | null; // 1-31
  bossName: string | null;
  salaryDay: number | null;
  oddCount: number | null;
  carryOverNumber: number | null;
};

type LottoActions = {
  setChecked: (id: LottoOptionId, value: boolean) => void;
  setLuckyNumber: (value: number | null) => void;
  setResignDay: (value: number | null) => void;
  setBossName: (value: string | null) => void;
  setSalaryDay: (value: number | null) => void;
  setOddCount: (value: number | null) => void;
  setCarryOverNumber: (value: number | null) => void;
  setDrawData: (data: LottoData) => void;
  generate: () => void;
  resetResult: () => void;
  resetOptions: () => void;
};

const initialChecked = LOTTO_OPTION_IDS.reduce(
  (acc, id) => ({ ...acc, [id]: false }),
  {} as Record<LottoOptionId, boolean>,
);

export const useLottoStore = create<LottoState & LottoActions>((set, get) => ({
  checked: initialChecked,
  resultContext: null,
  numbers: null,
  error: null,
  recentDraws: [],
  drawData: null,
  canUseRecentFive: false,
  canUseCarryOver: false,
  luckyNumber: null,
  resignDay: null,
  bossName: null,
  salaryDay: null,
  oddCount: null,
  carryOverNumber: null,

  setChecked: (id, value) => {
    const data = get().drawData;
    if (data) get().setDrawData(data);
    const other =
      id === "carry-over-one"
        ? "recent-5-times-not-appeared"
        : id === "recent-5-times-not-appeared"
          ? "carry-over-one"
          : null;
    if (value && other && get().checked[other]) {
      set({
        numbers: null,
        error:
          "최근 5회 제외와 직전 본번호 1개 포함은 함께 선택할 수 없어요. 먼저 다른 조건을 해제해 주세요.",
      });
      return;
    }
    const { canUseRecentFive, canUseCarryOver } = get();
    if (value && id === "recent-5-times-not-appeared" && !canUseRecentFive) {
      set({
        numbers: null,
        error: "최근 5회 기록이 모두 확인된 뒤 선택할 수 있어요.",
      });
      return;
    }
    if (value && id === "carry-over-one" && !canUseCarryOver) {
      set({ numbers: null, error: "직전 회차를 확인한 뒤 선택할 수 있어요." });
      return;
    }
    set((prev) => {
      const clear: Partial<LottoState> = {};
      if (id === "include-lucky-number" && !value) clear.luckyNumber = null;
      if (id === "resign-date-hash" && !value) clear.resignDay = null;
      if (id === "boss-name-exclusion" && !value) clear.bossName = null;
      if (id === "salary-day-energy" && !value) clear.salaryDay = null;
      if (id === "odd-even-balanced" && !value) clear.oddCount = null;
      if (id === "carry-over-one" && !value) clear.carryOverNumber = null;
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

  setCarryOverNumber: (value) =>
    set({ carryOverNumber: value, numbers: null, error: null }),

  resetResult: () => set({ numbers: null, error: null }),
  resetOptions: () =>
    set({
      checked: { ...initialChecked },
      ...EMPTY_INPUTS,
      numbers: null,
      error: null,
    }),

  setDrawData: (incoming) => {
    const data = getLottoDataAtTime(incoming);
    const available = getDrawAvailability(data);
    set({
      drawData: data,
      // 생성기는 기존처럼 마지막 배열을 직전 회차로 사용한다.
      // 공유/API 모델은 최신순을 유지하고 이 경계에서만 변환한다.
      recentDraws: [...data.draws]
        .sort((a, b) => a.episode - b.episode)
        .map((draw) => draw.numbers),
      canUseRecentFive: available.recentFive,
      canUseCarryOver: available.carryOver,
    });
  },

  generate: () => {
    const data = get().drawData;
    if (data) get().setDrawData(data);
    const state = get();
    if (
      state.checked["recent-5-times-not-appeared"] &&
      !state.canUseRecentFive
    ) {
      set({
        numbers: null,
        error:
          "최근 5회 기록을 확인하지 못했어요. 조건을 해제하거나 새로고침해 주세요.",
      });
      return;
    }
    if (state.checked["carry-over-one"] && !state.canUseCarryOver) {
      set({
        numbers: null,
        error:
          "직전 회차를 확인하지 못했어요. 조건을 해제하거나 새로고침해 주세요.",
      });
      return;
    }
    const latestDraw = state.drawData?.draws.find(
      (draw) => draw.episode === state.drawData?.latestEpisode,
    );
    if (
      state.checked["carry-over-one"] &&
      state.carryOverNumber !== null &&
      !latestDraw?.numbers.includes(state.carryOverNumber)
    ) {
      set({
        numbers: null,
        error: "직전 회차가 변경됐어요. 이월수를 해제한 뒤 다시 선택해 주세요.",
      });
      return;
    }
    const {
      checked,
      recentDraws,
      luckyNumber,
      resignDay,
      bossName,
      salaryDay,
      oddCount,
      carryOverNumber,
    } = get();
    const selected = new Set<LottoOptionId>(
      LOTTO_OPTION_IDS.filter((id) => checked[id]),
    );
    const result = generateLottoResult(selected, recentDraws, {
      luckyNumber,
      resignDay,
      bossName,
      salaryDay,
      oddCount,
      carryOverNumber,
    });
    if (result.status === "success") {
      const values = {
        "include-lucky-number": luckyNumber,
        "boss-name-exclusion": bossName ? getNameNumber(bossName) : null,
        "resign-date-hash": resignDay,
        "salary-day-energy": salaryDay
          ? Math.round((salaryDay * 45) / 31)
          : null,
        "odd-even-balanced": oddCount,
        "carry-over-one":
          result.numbers.find((n) => latestDraw?.numbers.includes(n)) ??
          carryOverNumber,
        "recent-5-times-not-appeared": null,
        "sum-between-100-and-170": null,
        "no-serial-numbers": null,
        "balanced-section": null,
        "diagonal-pattern": null,
      };
      set({
        numbers: result.numbers,
        error: null,
        resultContext: {
          targetEpisode:
            state.canUseCarryOver && latestDraw ? latestDraw.episode + 1 : null,
          conditions: [...selected].map((id) => ({ id, value: values[id] })),
        },
      });
      return;
    }

    set({
      numbers: null,
      error: result.message,
    });
  },
}));
