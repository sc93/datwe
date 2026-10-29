import { Plus } from "lucide-react";

import type { LottoDraw } from "@/lib/lotto-data";

import { LottoBall } from "./lotto-ball";

export function DrawNumbers({
  draw,
  compact = false,
}: {
  draw: LottoDraw;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-3 ${compact ? "" : "mt-5 mb-6"}`}
    >
      <div
        role="group"
        aria-label="본번호"
        className={compact ? "flex gap-1" : "flex gap-1.5 min-[480px]:gap-2"}
      >
        {draw.numbers.map((number) => (
          <LottoBall
            key={number}
            number={number}
            size={compact ? "sm" : "md"}
            className={compact ? "size-7 text-[11px]" : undefined}
          />
        ))}
      </div>
      <div
        role="group"
        aria-label="보너스 번호"
        className={`ml-auto flex items-start gap-2 ${compact ? "" : "border-l pl-3"}`}
      >
        <Plus
          aria-hidden="true"
          className={`text-muted-foreground shrink-0 ${compact ? "mt-2 size-3" : "mt-2.5 size-3.5 min-[480px]:mt-3.5"}`}
        />
        <div className="flex flex-col items-center gap-1">
          <LottoBall
            number={draw.bonus}
            size={compact ? "sm" : "md"}
            className={compact ? "size-7 text-[11px]" : undefined}
          />
          <span className="text-muted-foreground text-[10px]">보너스</span>
        </div>
      </div>
    </div>
  );
}
