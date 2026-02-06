"use client";

import { useEffect } from "react";

import { useLottoStore } from "../_store/lotto-store";

type Props = {
  recentDraws: number[][];
  children: React.ReactNode;
};

/**
 * 서버에서 가져온 최근 회차 당첨번호를 스토어에 넣어 둡니다.
 */
export default function LottoDrawsProvider({ recentDraws, children }: Props) {
  const setRecentDraws = useLottoStore((s) => s.setRecentDraws);

  useEffect(() => {
    setRecentDraws(recentDraws);
  }, [recentDraws, setRecentDraws]);

  return <>{children}</>;
}
