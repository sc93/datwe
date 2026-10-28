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
  const color =
    number <= 10
      ? "bg-lotto-yellow text-lotto-yellow-foreground"
      : number <= 20
        ? "bg-lotto-blue text-lotto-blue-foreground"
        : number <= 30
          ? "bg-lotto-red text-lotto-red-foreground"
          : number <= 40
            ? "bg-lotto-gray text-lotto-gray-foreground"
            : "bg-lotto-green text-lotto-green-foreground";

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
