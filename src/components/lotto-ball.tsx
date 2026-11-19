import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type LottoBallProps = ComponentProps<"span"> & {
  number: number;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "size-8 text-xs",
  md: "size-9 text-sm min-[480px]:size-11 min-[480px]:text-base",
  lg: "size-8 text-base min-[375px]:size-11 min-[375px]:text-lg min-[480px]:size-13 min-[480px]:text-xl",
};

export function LottoBall({
  number,
  size = "md",
  className,
  ...props
}: LottoBallProps) {
  function getBallColor() {
    if (number <= 10) {
      return "bg-lotto-yellow text-lotto-yellow-foreground";
    }
    if (number <= 20) {
      return "bg-lotto-blue text-lotto-blue-foreground";
    }
    if (number <= 30) {
      return "bg-lotto-red text-lotto-red-foreground";
    }
    if (number <= 40) {
      return "bg-lotto-gray text-lotto-gray-foreground";
    }
    return "bg-lotto-green text-lotto-green-foreground";
  }
  const color = getBallColor();

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-mono font-bold tabular-nums",
        sizes[size],
        color,
        className,
      )}
      {...props}
    >
      {number}
    </span>
  );
}
