"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { LottoData } from "@/lib/lotto-data";

import { useLottoStore } from "../_store/lotto-store";
import { RecentDrawsView } from "./recent-draws-view";

export default function RecentDraws({
  initialData,
}: {
  initialData: LottoData;
}) {
  const current = useLottoStore((s) => s.drawData);
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  return (
    <RecentDrawsView
      data={current ?? initialData}
      isRefreshing={isRefreshing}
      onRefresh={() => startTransition(() => router.refresh())}
    />
  );
}
