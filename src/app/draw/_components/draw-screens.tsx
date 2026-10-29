"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { trackLottoEvent } from "@/app/(home)/_lib/analytics";
import { DrawNumbers } from "@/components/draw-numbers";
import { Button } from "@/components/ui/button";
import type { DrawDetailData } from "@/lib/draw-detail";
import { drawHref, listHref, parseRoundInput } from "@/lib/draw-navigation";
import type { DrawRangeResult, DrawResult } from "@/lib/draw-reader";
import { mergeDrawRange } from "@/lib/draw-refresh";
import { consumeSearchVisit, expectSearchVisit } from "@/lib/draw-visit";

import {
  AnalysisPanel,
  checkedLabel,
  dateLabel,
  DrawCard,
  DrawDisclaimer,
  Notice,
  OFFICIAL_RESULT_URL,
  RangeNavigation,
} from "./draw-views";

const snapshots = new Map<string, { query: string; scroll: number }>();
let popNavigation = false;
export function DrawNavigationBoundary({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onPop = () => {
      popNavigation = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return children;
}
function usePageState(
  key: string,
  defaultQuery = "",
  headingId = "draw-page-heading",
) {
  const [query, setQueryState] = useState(
    () => snapshots.get(key)?.query ?? defaultQuery,
  );
  const setQuery = (value: string) => {
    setQueryState(value);
    snapshots.set(key, { query: value, scroll: window.scrollY });
  };
  useEffect(() => {
    const restore = popNavigation;
    popNavigation = false;
    const stored = snapshots.get(key);
    const frame = requestAnimationFrame(() => {
      if (restore && stored) window.scrollTo(0, stored.scroll);
      else
        (
          document.getElementById(headingId) ??
          document.getElementById("draw-page-heading")
        )?.focus({ preventScroll: true });
    });
    const saveScroll = () =>
      snapshots.set(key, {
        query: snapshots.get(key)?.query ?? defaultQuery,
        scroll: window.scrollY,
      });
    window.addEventListener("scroll", saveScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", saveScroll);
    };
  }, [key, defaultQuery, headingId]);
  return { query, setQuery };
}
async function getJSON<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok && response.status !== 503 && response.status !== 400)
    throw new Error("조회 실패");
  return response.json() as Promise<T>;
}
function useReload<T>(
  initial: T,
  url: string,
  hasRecords: (value: T) => boolean,
  reconcile: (previous: T, next: T) => T = (_previous, next) => next,
) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function reload() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const next = await getJSON<T>(url, controller.signal);
      if (controller.signal.aborted) return;
      if (hasRecords(data) && !hasRecords(next))
        setError("다시 조회하지 못했어요. 기존에 확인한 기록을 유지해요.");
      else setData((previous) => reconcile(previous, next));
    } catch {
      if (!controller.signal.aborted)
        setError("조회에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return { data, busy, error, reload };
}
function Search({
  latest,
  to,
  query,
  setQuery,
  confirmedEpisode,
}: {
  latest: number | null;
  confirmedEpisode?: number;
  to?: number;
  query: string;
  setQuery: (value: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <form
      className="my-6"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseRoundInput(query, latest);
        if (parsed.error) {
          setError(parsed.error);
          return;
        }
        setError("");
        if (expectSearchVisit(parsed.episode!, confirmedEpisode)) {
          trackLottoEvent({ name: "draw_search_complete" });
          return;
        }
        router.push(drawHref(parsed.episode!, to));
      }}
      noValidate
    >
      <label htmlFor="round-query" className="mb-2 block text-sm font-medium">
        회차 번호
      </label>
      <div className="flex gap-2">
        <input
          id="round-query"
          type="text"
          inputMode="numeric"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-invalid={!!error}
          aria-describedby="round-range round-error"
          placeholder="예: 47"
          className="border-input bg-background min-w-0 flex-1 rounded-md border px-3 text-base"
        />
        <Button type="submit">검색</Button>
      </div>
      <p
        id="round-error"
        role="alert"
        className="text-destructive mt-2 text-sm"
      >
        {error}
      </p>
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <span id="round-range">
          {latest === null
            ? "최신 회차 미확인 · 과거 회차 조회 가능"
            : `조회 가능 1–${latest.toLocaleString("ko-KR")}회`}
        </span>
        <Button
          variant="ghost"
          type="button"
          className="text-primary px-0 text-xs"
          onClick={() => {
            setQuery("");
            setError("");
            snapshots.set("/draw", { query: "", scroll: 0 });
            router.push("/draw");
          }}
        >
          검색 초기화
        </Button>
      </div>
    </form>
  );
}
function Heading({ children }: { children: ReactNode }) {
  return (
    <h1
      id="draw-page-heading"
      tabIndex={-1}
      className="mt-3 text-2xl font-bold tracking-tight"
    >
      {children}
    </h1>
  );
}
const latestNumber = (latest: DrawResult | null) =>
  latest?.status === "fresh" ? (latest.draw?.episode ?? null) : null;
export function InvalidDrawScreen() {
  usePageState("invalid");
  return (
    <>
      <Heading>주소를 확인해 주세요</Heading>
      <Notice title="올바른 회차 주소가 아니에요">
        회차와 목록 구간은 1 이상의 정수 하나로 지정해 주세요.
      </Notice>
      <Button asChild variant="outline">
        <Link href="/draw">최신 목록으로</Link>
      </Button>
    </>
  );
}
export function DrawListScreen({
  initial,
  to,
}: {
  initial: DrawRangeResult;
  to?: number;
}) {
  const { query, setQuery } = usePageState(
    listHref(to),
    "",
    "draw-results-heading",
  );
  const { data, busy, error, reload } = useReload(
    initial,
    `/api/lotto/draws${to === undefined ? "" : `?to=${to}`}`,
    (value: DrawRangeResult) => value.slots.some((slot) => slot.draw),
    mergeDrawRange,
  );
  const latest = latestNumber(data.latest);
  return (
    <section aria-busy={busy}>
      <Link
        href="/"
        className="text-primary inline-flex min-h-11 items-center gap-2 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        메인으로
      </Link>
      <Heading>회차별 당첨번호</Heading>
      <p className="text-muted-foreground mt-2 text-sm">
        지난 결과의 조합 특성을 살펴보세요.
      </p>
      <Search latest={latest} to={to} query={query} setQuery={setQuery} />
      {error && <Notice title={error} />}
      {latest === null && data.status !== "latest-unknown" && (
        <Notice title="최신 회차를 확인하지 못했어요">
          아래는 조회한 과거 기록이에요. 최신 상한은 확인되지 않았어요.
        </Notice>
      )}
      {data.status === "invalid-range" ? (
        <Notice title="조회 가능한 범위를 벗어났어요">
          <Link
            href="/draw"
            className="text-primary inline-flex min-h-11 items-center underline"
          >
            최신 목록으로
          </Link>
        </Notice>
      ) : data.to === null ? (
        <Notice title="최신 회차를 확인하지 못했어요">
          최신 목록을 다시 조회하거나 알고 있는 과거 회차를 검색해 주세요.
        </Notice>
      ) : (
        <>
          <div className="border-primary flex flex-wrap items-center justify-between gap-2 border-b-2 py-3">
            <h2
              id="draw-results-heading"
              tabIndex={-1}
              className="text-lg font-bold"
            >
              {data.to}–{data.from}회
            </h2>
            <span className="text-muted-foreground text-xs">
              최신순 · {data.slots.length}회 구간
            </span>
          </div>
          <RangeNavigation to={data.to} latest={latest} />
          {data.status === "empty" && (
            <Notice title="표시할 추첨 기록이 없어요">
              정상 응답에서 확인된 기록이 0건이에요. 없는 회차라는 뜻은
              아니에요.
            </Notice>
          )}
          {data.status === "unavailable" && (
            <Notice title="당첨번호를 불러오지 못했어요">
              조회에 실패했어요. 없는 회차라는 뜻은 아니에요.
            </Notice>
          )}
          {data.status === "stale" && (
            <Notice title="저장된 과거 기록을 표시해요">
              원천 확인 후 시간이 지난 기록이에요. 다시 조회할 수 있어요.
            </Notice>
          )}
          <ol aria-label="회차별 당첨번호">
            {data.slots.map((slot) =>
              slot.draw ? (
                <DrawCard
                  key={slot.episode}
                  draw={slot.draw}
                  to={to}
                  stale={slot.status === "stale"}
                  checkedAt={slot.checkedAt}
                />
              ) : (
                <li key={slot.episode}>
                  <Notice
                    title={`제 ${slot.episode}회 ${slot.status === "empty" ? "기록 미확인" : "조회 실패"}`}
                  >
                    <p>다른 회차는 계속 확인할 수 있어요.</p>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={reload}
                      className="mt-2 text-xs"
                    >
                      누락 회차 다시 불러오기
                    </Button>
                  </Notice>
                </li>
              ),
            )}
          </ol>
          <p className="text-muted-foreground mt-5 text-xs">
            {data.to}–{data.from}회 구간
          </p>
          <RangeNavigation to={data.to} latest={latest} />
        </>
      )}
      <Button
        variant="outline"
        onClick={reload}
        disabled={busy}
        className="mt-2 text-sm"
      >
        {busy ? "불러오는 중…" : "다시 조회하기"}
      </Button>
      <DrawDisclaimer />
    </section>
  );
}
export function DrawDetailScreen({
  initial,
  episode,
  to,
}: {
  initial: DrawDetailData;
  episode: number;
  to?: number;
}) {
  const { query, setQuery } = usePageState(
    drawHref(episode, to),
    String(episode),
  );
  const { data, busy, error, reload } = useReload(
    initial,
    `/api/lotto/draws/${episode}`,
    (value: DrawDetailData) => value.target.draw !== null,
  );
  const latest = latestNumber(data.latest),
    target = data.target;
  const tracked = useRef(false);
  useEffect(() => {
    if (!data.target.draw) {
      consumeSearchVisit(episode);
      return;
    }
    if (tracked.current) return;
    tracked.current = true;
    trackLottoEvent({ name: "draw_detail_view" });
    if (consumeSearchVisit(episode))
      trackLottoEvent({ name: "draw_search_complete" });
  }, [data.target.draw, episode]);
  return (
    <section aria-busy={busy}>
      <div className="flex flex-wrap justify-between gap-2">
        <Link
          href={listHref(to)}
          className="text-primary inline-flex min-h-11 items-center gap-2 text-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          목록으로
        </Link>
        <Link
          href="/"
          className="text-primary inline-flex min-h-11 items-center text-sm"
        >
          메인으로
        </Link>
      </div>
      <Heading>제 {episode}회 당첨번호</Heading>
      <Search
        latest={latest}
        to={to}
        query={query}
        setQuery={setQuery}
        confirmedEpisode={target.draw ? episode : undefined}
      />
      {error && <Notice title={error} />}
      {latest === null && (
        <Notice title="최신 상한 미확인">
          과거 회차는 별도로 조회할 수 있어요.
        </Notice>
      )}
      {target.draw ? (
        <>
          <div className="border-primary border-b-2 pb-5">
            <time
              dateTime={target.draw.drawDate}
              className="text-muted-foreground font-mono text-sm"
            >
              {dateLabel(target.draw.drawDate)} 추첨
            </time>
            <DrawNumbers draw={target.draw} />
            <p className="text-muted-foreground text-xs">
              {target.status === "stale" ? "저장된 과거 기록 · " : ""}
              {target.checkedAt && checkedLabel(target.checkedAt)}
            </p>
            <a
              href={OFFICIAL_RESULT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground mt-2 inline-flex min-h-11 items-center gap-1 text-xs underline underline-offset-4"
            >
              동행복권 공식 출처{" "}
              <ExternalLink aria-hidden="true" className="size-3" />
              <span className="sr-only">(새 탭)</span>
            </a>
          </div>
          <HistoryAnalysis key={episode} draw={target.draw} />
        </>
      ) : (
        <Notice
          title={
            target.status === "invalid-range"
              ? "조회 가능한 범위를 벗어났어요"
              : target.status === "empty"
                ? "확인된 추첨 기록이 없어요"
                : "당첨번호를 불러오지 못했어요"
          }
        >
          {target.status !== "invalid-range" && (
            <p>조회 실패나 미확인을 없는 회차로 단정하지 않아요.</p>
          )}
          <Button
            variant="outline"
            onClick={reload}
            disabled={busy}
            className="mt-3"
          >
            {busy ? "불러오는 중…" : "대상 회차 다시 불러오기"}
          </Button>
        </Notice>
      )}
      {target.draw && (
        <Button
          variant="outline"
          onClick={reload}
          disabled={busy}
          className="mt-5"
        >
          {busy ? "불러오는 중…" : "대상 회차 새로고침"}
        </Button>
      )}
      <Button asChild variant="ghost" className="mt-5">
        <Link href={listHref(to)}>목록으로 돌아가기</Link>
      </Button>
      <DrawDisclaimer />
    </section>
  );
}
function HistoryAnalysis({ draw }: { draw: NonNullable<DrawResult["draw"]> }) {
  const [history, setHistory] = useState<DrawRangeResult | null>(null);
  const [loading, setLoading] = useState(draw.episode > 1);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (draw.episode === 1) return;
    const controller = new AbortController();
    getJSON<DrawRangeResult>(
      `/api/lotto/draws/${draw.episode}/previous`,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted)
          setHistory((previous) =>
            previous ? mergeDrawRange(previous, result) : result,
          );
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [draw.episode, attempt]);
  return (
    <AnalysisPanel
      draw={draw}
      history={history}
      loading={loading}
      onRetry={() => {
        trackLottoEvent({ name: "draw_history_retry" });
        setLoading(true);
        setAttempt((value) => value + 1);
      }}
    />
  );
}
