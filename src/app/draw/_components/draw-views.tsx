import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DrawNumbers } from "@/components/draw-numbers";
import { Button } from "@/components/ui/button";
import {
  type AnalysisItem,
  analyzeDraw,
  summarizeDraw,
} from "@/lib/draw-analysis";
import { drawHref, listHref, rangeNavigation } from "@/lib/draw-navigation";
import type { DrawRangeResult } from "@/lib/draw-reader";
import type { LottoDraw } from "@/lib/lotto-data";

export const OFFICIAL_RESULT_URL = "https://www.dhlottery.co.kr/lt645/result";
export const dateLabel = (date: string) => `${date.replaceAll("-", ". ")}.`;
export function checkedLabel(value: string) {
  const date = new Date(Date.parse(value) + 9 * 60 * 60 * 1000).toISOString();
  return `${date.slice(0, 10).replaceAll("-", ". ")}. ${date.slice(11, 16)} 확인`;
}
export function Notice({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="bg-muted my-4 rounded-lg border p-4 text-sm leading-7"
    >
      <strong className="block font-semibold">{title}</strong>
      {children}
    </div>
  );
}
export function DrawCard({
  draw,
  to,
  stale = false,
  checkedAt,
}: {
  draw: LottoDraw;
  to?: number;
  stale?: boolean;
  checkedAt?: string | null;
}) {
  const summary = summarizeDraw(draw);
  if (!summary)
    return (
      <li>
        <Notice title={`제 ${draw.episode}회 기록을 확인하지 못했어요`} />
      </li>
    );
  return (
    <li className="border-b">
      <Link
        href={drawHref(draw.episode, to)}
        prefetch={false}
        aria-label={`제 ${draw.episode}회 당첨번호 상세`}
        className="hover:bg-secondary/40 block rounded-sm py-5 focus-visible:outline-offset-[-3px]"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">제 {draw.episode}회</h3>
          <div className="flex items-center gap-3">
            <time
              dateTime={draw.drawDate}
              className="text-muted-foreground font-mono text-xs"
            >
              {dateLabel(draw.drawDate)}
            </time>
            <ArrowRight
              aria-hidden="true"
              className="text-primary size-4 shrink-0"
            />
          </div>
        </div>
        <div className="my-4">
          <DrawNumbers draw={draw} compact />
        </div>
        <p className="text-sm leading-7">
          합계 {summary.sum} · 홀수 {summary.oddCount} / 짝수{" "}
          {summary.evenCount}
          <br />
          {summary.consecutiveLabel}
        </p>
        {stale && (
          <p className="text-muted-foreground mt-2 text-xs leading-6">
            저장된 기록{checkedAt && ` · ${checkedLabel(checkedAt)}`}
          </p>
        )}
      </Link>
    </li>
  );
}
export function RangeNavigation({
  to,
  latest,
}: {
  to: number;
  latest: number | null;
}) {
  const nav = rangeNavigation(to, latest);
  return (
    <nav aria-label="회차 구간 이동" className="my-4 flex flex-wrap gap-2">
      {nav.previous === null ? (
        <Button disabled variant="outline" className="flex-1 text-xs">
          ← 이전 20회
        </Button>
      ) : (
        <Button asChild variant="outline" className="flex-1 text-xs">
          <Link href={listHref(nav.previous)}>← 이전 20회</Link>
        </Button>
      )}
      {nav.next === null ? (
        <Button disabled variant="outline" className="flex-1 text-xs">
          최근 20회 →
        </Button>
      ) : (
        <Button asChild variant="outline" className="flex-1 text-xs">
          <Link href={listHref(nav.next)}>최근 20회 →</Link>
        </Button>
      )}
      <Button asChild variant="ghost" className="text-primary text-xs">
        <Link href="/draw">최신 목록</Link>
      </Button>
    </nav>
  );
}
function AnalysisRow({
  title,
  item,
  children,
}: {
  title: string;
  item: AnalysisItem<unknown>;
  children: ReactNode;
}) {
  const label = {
    met: "충족",
    unmet: "미충족",
    observed: "개수 표시",
    unavailable: "판정 불가",
  }[item.status];
  return (
    <section className="border-b py-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold">{title}</h3>
        <span
          className={`shrink-0 text-xs ${item.status === "unmet" ? "text-destructive" : "text-primary"}`}
        >
          {label}
        </span>
      </div>
      <div className="mt-2 text-sm leading-7 wrap-anywhere">{children}</div>
      <p className="text-muted-foreground mt-2 text-xs leading-6">
        {item.rule}
      </p>
      {item.basisEpisodes.length > 0 && (
        <p className="text-muted-foreground text-xs leading-6">
          기준: {item.basisEpisodes.join(" · ")}회 본번호
        </p>
      )}
    </section>
  );
}
export function AnalysisPanel({
  draw,
  history,
  loading,
  onRetry,
}: {
  draw: LottoDraw;
  history: DrawRangeResult | null;
  loading: boolean;
  onRetry: () => void;
}) {
  const analysis = analyzeDraw(
    draw,
    history?.slots.flatMap((slot) => (slot.draw ? [slot.draw] : [])) ?? [],
  );
  if (!analysis) return <Notice title="분석할 본번호를 확인하지 못했어요" />;
  const c = analysis.conditions;
  const historyRow = (five: boolean) => {
    const item = five ? c.previousFive : c.previousOne;
    const needsHistory = five ? draw.episode > 5 : draw.episode > 1;
    if (loading && needsHistory && item.status === "unavailable")
      return (
        <section className="border-b py-5" aria-busy="true">
          <h3 className="font-semibold">
            {five ? "이전 5회 본번호 제외" : "직전 본번호 정확히 1개"}
          </h3>
          <p role="status" className="text-muted-foreground mt-3 text-sm">
            이전 기록을 확인하고 있어요.
          </p>
        </section>
      );
    return (
      <AnalysisRow
        title={five ? "이전 5회 본번호 제외" : "직전 본번호 정확히 1개"}
        item={item}
      >
        {item.value ? (
          <p>
            겹친 번호 {item.value.matchedCount}개 ·{" "}
            {item.value.matchedNumbers.join(", ") || "없음"}
          </p>
        ) : (
          <>
            <p>
              {item.reason === "insufficient-history"
                ? five
                  ? "이전 5회 기록이 존재하지 않아요."
                  : "이전 회차가 존재하지 않아요."
                : "필요한 이전 기록을 모두 확인하지 못했어요."}
            </p>
            {item.missingEpisodes.length > 0 && (
              <p>미확인 회차: {item.missingEpisodes.join(", ")}</p>
            )}
            {item.invalidEpisodes.length > 0 && (
              <p>검증하지 못한 회차: {item.invalidEpisodes.join(", ")}</p>
            )}
            {needsHistory && (
              <Button
                variant="outline"
                className="mt-3 text-xs"
                onClick={onRetry}
              >
                이전 기록 다시 불러오기
              </Button>
            )}
          </>
        )}
      </AnalysisRow>
    );
  };
  return (
    <section aria-labelledby="analysis-heading">
      <h2 id="analysis-heading" className="mt-7 text-xl font-bold">
        조합 조건 분석
      </h2>
      <p className="text-muted-foreground mt-2 text-xs leading-6">
        제 {draw.episode}회 본번호 6개 기준 · 보너스 제외
      </p>
      <AnalysisRow title="합계 100–170" item={c.sum}>
        합계 {analysis.summary.sum} = {draw.numbers.join(" + ")}
      </AnalysisRow>
      <AnalysisRow title="홀짝" item={c.oddEven}>
        홀수 {analysis.summary.oddCount}개 · 짝수 {analysis.summary.evenCount}개
      </AnalysisRow>
      <AnalysisRow title="3연번 제한" item={c.consecutive}>
        {analysis.summary.consecutiveLabel}
        {analysis.summary.consecutiveRuns.map((run, i) => (
          <p key={i}>{run.join(" · ")}</p>
        ))}
      </AnalysisRow>
      <AnalysisRow title="구간별 분포" item={c.sections}>
        <p className="flex flex-wrap gap-x-3">
          {["1–9", "10–19", "20–29", "30–39", "40–45"].map((label, i) => (
            <span key={label}>
              {label}: {c.sections.value?.counts[i]}개
            </span>
          ))}
        </p>
        {!!c.sections.value?.missingSections.length && (
          <p>빈 구간: {c.sections.value.missingSections.join(", ")}</p>
        )}
      </AnalysisRow>
      <AnalysisRow title="직선·대각선 마킹 제한" item={c.marking}>
        {c.marking.value?.violations.length ? (
          c.marking.value.violations.map((v, i) => (
            <p key={i}>
              {v.numbers.join(" · ")} ·{" "}
              {
                {
                  horizontal: "가로",
                  vertical: "세로",
                  "diagonal-down": "오른쪽 아래 대각선",
                  "diagonal-up": "왼쪽 아래 대각선",
                }[v.direction]
              }
            </p>
          ))
        ) : (
          <p>같은 직선·대각선 위 세 점 없음</p>
        )}
        <div
          className="mt-3 grid w-fit grid-cols-5 gap-1"
          aria-label="5열 9행 번호 마킹"
        >
          {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className={`flex size-7 items-center justify-center rounded text-xs ${draw.numbers.includes(n) ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"}`}
              aria-label={`${n}${draw.numbers.includes(n) ? " 선택됨" : ""}`}
            >
              {n}
            </span>
          ))}
        </div>
      </AnalysisRow>
      {history?.slots.some((slot) => slot.status === "stale") && (
        <Notice title="이전 기록 일부는 저장된 기록이에요">
          {history.slots
            .filter((slot) => slot.status === "stale")
            .map((slot) => (
              <p key={slot.episode}>
                제 {slot.episode}회
                {slot.checkedAt && ` · ${checkedLabel(slot.checkedAt)}`}
              </p>
            ))}
          <Button
            variant="outline"
            className="mt-2 text-xs"
            disabled={loading}
            onClick={onRetry}
          >
            {loading ? "불러오는 중…" : "이전 기록 다시 불러오기"}
          </Button>
        </Notice>
      )}
      {historyRow(true)}
      {historyRow(false)}
    </section>
  );
}
export function DrawDisclaimer() {
  return (
    <p className="text-muted-foreground mt-7 text-xs leading-6">
      과거 추첨 결과를 설명하는 정보예요. 특정 조건이 당첨 확률을 높이거나 다음
      결과를 예측하지 않아요.
    </p>
  );
}
