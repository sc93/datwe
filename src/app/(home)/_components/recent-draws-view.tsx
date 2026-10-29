"use client";

import { ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";

import { DrawNumbers } from "@/components/draw-numbers";
import { Button } from "@/components/ui/button";
import type { LottoData } from "@/lib/lotto-data";

import { trackLottoEvent } from "../_lib/analytics";

const OFFICIAL_RESULT_URL = "https://www.dhlottery.co.kr/lt645/result";

function dateLabel(date: string) {
  return `${date.replaceAll("-", ". ")}.`;
}

/** 한국 표준시 숫자 형식을 고정해 서버·브라우저 ICU 차이를 없앤다. */
function checkedAtLabel(value: string) {
  const seoul = new Date(Date.parse(value) + 9 * 60 * 60 * 1000).toISOString();
  return `${seoul.slice(0, 10).replaceAll("-", ". ")}. ${seoul.slice(11, 16)}`;
}

export function RecentDrawsView({
  data,
  isRefreshing,
  onRefresh,
}: {
  data: LottoData;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const draws =
    data.status === "unavailable"
      ? []
      : [...data.draws].sort((a, b) => b.episode - a.episode).slice(0, 5);
  const latest = draws.find((draw) => draw.episode === data.latestEpisode);
  const statusLabel =
    data.status === "fresh"
      ? "추첨 완료"
      : data.status === "stale"
        ? null
        : "일부 기록 누락";
  return (
    <section aria-labelledby="recent-draws-heading" aria-busy={isRefreshing}>
      <span className="text-primary font-mono text-[10px] tracking-[0.15em]">
        WEEKLY RECORD
      </span>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1
          id="recent-draws-heading"
          className="text-[22px] font-bold tracking-tight"
        >
          최근 당첨번호
        </h1>
        {latest && (
          <time
            dateTime={latest.drawDate}
            className="text-muted-foreground font-mono text-[11px]"
          >
            {dateLabel(latest.drawDate)}
          </time>
        )}
      </div>
      {latest && (
        <div data-slot="latest-draw" className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-secondary text-primary rounded px-2.5 py-1 text-xs font-semibold">
              제 {latest.episode}회
            </span>
            {statusLabel && (
              <span className="text-muted-foreground text-xs">
                {statusLabel}
              </span>
            )}
          </div>
          <DrawNumbers draw={latest} />
        </div>
      )}
      {(data.status === "partial" || data.status === "unavailable") && (
        <div
          role="status"
          className="bg-muted mt-4 rounded-xl border p-4 text-xs leading-6"
        >
          <strong className="block text-sm font-semibold">
            {data.status === "unavailable"
              ? "당첨번호를 불러오지 못했어요"
              : "일부 회차를 확인하지 못했어요"}
          </strong>
          <p className="text-muted-foreground mt-1">
            {data.status === "unavailable"
              ? "잠시 후 다시 확인해 주세요. 일반 번호 생성은 사용할 수 있어요."
              : "확인된 회차만 표시해요. 최근 5회 제외는 기록이 모두 확인된 뒤 사용할 수 있어요."}
          </p>
          {data.missingEpisodes.length > 0 && (
            <p className="mt-2">
              확인하지 못한 회차: {data.missingEpisodes.join(", ")}
            </p>
          )}
          {data.checkedAt && (
            <p className="text-muted-foreground mt-2 text-[11px]">
              마지막 확인: {checkedAtLabel(data.checkedAt)}
            </p>
          )}
        </div>
      )}
      {!latest && draws.length > 0 && (
        <p className="text-muted-foreground mt-3 text-xs">
          최신 회차의 번호를 확인하지 못했어요.
        </p>
      )}
      <Link
        href="/draw"
        onClick={() => trackLottoEvent({ name: "draw_list_open" })}
        className="text-primary mt-6 flex min-h-11 items-center justify-between gap-2 border-y py-3 text-sm font-medium"
      >
        지난 당첨번호 보기 <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
        <a
          href={OFFICIAL_RESULT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground inline-flex min-h-11 items-center gap-1 text-[11px] underline underline-offset-4"
        >
          동행복권에서 확인 <span className="sr-only">(새 탭)</span>
          <ExternalLink aria-hidden="true" className="size-3" />
        </a>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isRefreshing}
          onClick={onRefresh}
          className="text-primary px-1 text-xs"
        >
          <RefreshCw
            aria-hidden="true"
            className={isRefreshing ? "motion-safe:animate-spin" : undefined}
          />
          {isRefreshing
            ? "불러오는 중…"
            : data.status === "unavailable"
              ? "다시 불러오기"
              : "새로고침"}
        </Button>
      </div>
    </section>
  );
}

export function RecentDrawsLoading() {
  return (
    <section aria-labelledby="recent-draws-loading-heading" aria-busy="true">
      <span className="text-primary font-mono text-[10px] tracking-[0.15em]">
        WEEKLY RECORD
      </span>
      <h1
        id="recent-draws-loading-heading"
        className="mt-2 text-[22px] font-bold tracking-tight"
      >
        최근 당첨번호
      </h1>
      <div
        aria-hidden="true"
        className="mt-5 flex justify-between gap-1.5 motion-safe:animate-pulse"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className="bg-muted size-9 rounded-full min-[480px]:size-11"
          />
        ))}
      </div>
      <p
        role="status"
        className="text-muted-foreground mt-4 border-b pb-4 text-xs"
      >
        당첨번호를 불러오고 있어요. 번호는 먼저 생성할 수 있어요.
      </p>
    </section>
  );
}
