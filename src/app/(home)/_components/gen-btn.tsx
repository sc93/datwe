"use client";

import { ArrowUpRight, Asterisk } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useLottoStore } from "../_store/lotto-store";

export default function GenBtn() {
  const generate = useLottoStore((s) => s.generate);
  const checked = useLottoStore((s) => s.checked);
  const count = Object.values(checked).filter(Boolean).length;

  return (
    <div className="bg-background fixed bottom-0 left-1/2 z-40 w-full max-w-150 -translate-x-1/2 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] min-[480px]:px-6">
      <div className="text-muted-foreground mb-2.5 flex justify-between gap-3 text-[11px]">
        <span>{count ? `선택한 조건 ${count}개` : "선택한 조건 없음"}</span>
        <span>6개의 작은 기대</span>
      </div>
      <Button
        size="lg"
        className="relative h-14 w-full rounded-xl text-base font-semibold"
        onClick={generate}
      >
        <Asterisk aria-hidden="true" className="size-5" />
        번호 생성하기
        <ArrowUpRight aria-hidden="true" className="absolute right-4 size-5" />
      </Button>
    </div>
  );
}
