"use client";

import type { LottoData } from "@/lib/lotto-data";

import { useLottoStore } from "../_store/lotto-store";

export default function DrawDataStatus({
  initialData,
}: {
  initialData: LottoData;
}) {
  const current = useLottoStore((s) => s.drawData);
  const result = current ?? initialData;
  const statusText =
    result.status === "fresh"
      ? `최근 추첨 제 ${result.latestEpisode}회`
      : result.status === "stale"
        ? `제 ${result.latestEpisode}회 기록 · 갱신 지연`
        : result.status === "partial"
          ? `확인된 제 ${result.latestEpisode}회 · 일부 기록 누락`
          : "최근 회차를 확인하지 못했어요";
  return (
    <div className="text-muted-foreground flex min-h-11 flex-wrap items-center justify-between gap-2 border-b pb-4 text-xs">
      <span className="text-primary font-mono text-[10px] tracking-[0.15em]">
        WEEKLY RECORD
      </span>
      <p>{statusText}</p>
      {result.status !== "fresh" && (
        <p role="status" className="w-full text-xs leading-5">
          {result.status === "stale"
            ? "마지막으로 확인한 기록이에요. 최신 회차 조건은 새로고침 후 사용할 수 있어요."
            : result.status === "partial"
              ? "최근 5회 기록이 모두 확인되지 않아 최근 번호 제외 조건은 사용할 수 없어요."
              : "잠시 후 다시 확인해 주세요. 일반 번호 생성은 사용할 수 있어요."}
          {result.checkedAt && (
            <span className="mt-1 block">
              마지막 확인:{" "}
              {new Intl.DateTimeFormat("ko-KR", {
                timeZone: "Asia/Seoul",
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(result.checkedAt))}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
