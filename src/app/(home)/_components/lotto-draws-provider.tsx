"use client";

import { useEffect } from "react";

import {
  DRAW_FRESHNESS_MS,
  getLottoDataAtTime,
  type LottoData,
} from "@/lib/lotto-data";

import { useLottoStore } from "../_store/lotto-store";

type Props = {
  data: LottoData;
  children: React.ReactNode;
};

/**
 * 서버에서 검증한 회차와 조회 상태를 스토어에 전달합니다.
 */
export default function LottoDrawsProvider({ data, children }: Props) {
  const setDrawData = useLottoStore((s) => s.setDrawData);

  useEffect(() => {
    const sync = () => setDrawData(getLottoDataAtTime(data));
    sync();
    if (
      (data.status !== "fresh" && data.status !== "partial") ||
      !data.checkedAt
    )
      return;
    const delay = Math.max(
      0,
      Date.parse(data.checkedAt) + DRAW_FRESHNESS_MS - Date.now(),
    );
    const timer = window.setTimeout(sync, delay);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [data, setDrawData]);

  return <>{children}</>;
}
