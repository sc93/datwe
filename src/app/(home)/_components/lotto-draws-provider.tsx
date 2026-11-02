"use client";

import { useEffect } from "react";

import { getLottoDataAtTime, type LottoData } from "@/lib/lotto-data";
import { RECENT_RECHECK_MS } from "@/lib/lotto-refresh";

import { useLottoStore } from "../_store/lotto-store";

type Props = { data: LottoData; children: React.ReactNode };

export default function LottoDrawsProvider({ data, children }: Props) {
  const setDrawData = useLottoStore((s) => s.setDrawData);
  const refresh = useLottoStore((s) => s.refreshDrawData);
  const validUntil = useLottoStore((s) => s.drawData?.validUntil);
  useEffect(() => {
    setDrawData(getLottoDataAtTime(data));
  }, [data, setDrawData]);
  useEffect(() => {
    const sync = () => {
      const current = useLottoStore.getState().drawData;
      if (current) setDrawData(getLottoDataAtTime(current));
      if (document.visibilityState !== "hidden") void refresh();
    };
    // 추첨 경계에서는 즉시 제한하고 서버의 새 공식 최신을 재확인한다.
    const boundary = Date.parse(validUntil ?? "");
    const timer =
      Number.isFinite(boundary) && boundary > Date.now()
        ? window.setTimeout(sync, Math.min(boundary - Date.now(), 2147483647))
        : undefined;
    const interval = window.setInterval(() => {
      const current = useLottoStore.getState().drawData;
      if (
        !current ||
        getLottoDataAtTime(current).status === "stale" ||
        current.status === "unavailable" ||
        current.status === "not-collected" ||
        current.status === "partial"
      )
        sync();
    }, RECENT_RECHECK_MS);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [validUntil, setDrawData, refresh]);
  return <>{children}</>;
}
