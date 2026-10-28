"use client";

import { create } from "zustand";

import {
  getDrawAvailability,
  getLottoDataAtTime,
  type LottoData,
} from "@/lib/lotto-data";

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
    const result = generateLottoNumbers(selected, recentDraws, {
      luckyNumber,
      resignDay,
      bossName,
      salaryDay,
      oddCount,
      carryOverNumber,
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
