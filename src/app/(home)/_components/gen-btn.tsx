"use client";

import { Button } from "@/components/ui/button";

import { useLottoStore } from "../_store/lotto-store";

export default function GenBtn() {
  const generate = useLottoStore((s) => s.generate);

  return (
    <Button
      size="lg"
      className="h-14 w-full rounded-xl text-lg font-bold text-white"
      onClick={generate}
    >
      번호 생성하기
    </Button>
  );
}
