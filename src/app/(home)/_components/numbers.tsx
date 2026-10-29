"use client";

import { useCallback, useEffect, useState } from "react";

import { LottoBall } from "@/components/lotto-ball";
import { Button } from "@/components/ui/button";

import { trackLottoEvent } from "../_lib/analytics";
import { conditionLabel } from "../_lib/condition-summary";
import { copyNumbers } from "../_lib/number-copy";
import {
  addSavedNumber,
  deleteSavedNumber,
  loadSavedNumbers,
  MAX_SAVED,
  type SavedNumber,
  STORAGE_KEY,
} from "../_lib/saved-numbers";
import { useLottoStore } from "../_store/lotto-store";

function formatSavedAt(ts: number): string {
  if (!ts) return "저장 시각 정보 없음";
  const date = new Date(ts + 9 * 60 * 60 * 1000).toISOString();
  return `${date.slice(0, 10).replaceAll("-", ". ")}. ${date.slice(11, 16)} (한국 시간)`;
}
const episodeLabel = (episode: number | null) =>
  episode === null ? "대상 회차 정보 없음" : `대상 제 ${episode}회`;
type Notice = { error: boolean; text: string } | null;

export default function Numbers() {
  const numbers = useLottoStore((s) => s.numbers);
  const error = useLottoStore((s) => s.error);
  const context = useLottoStore((s) => s.resultContext);
  const [saved, setSaved] = useState<SavedNumber[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const reloadSaved = useCallback(() => {
    try {
      const result = loadSavedNumbers(window.localStorage);
      setSaved(result.items);
      setStorageError(result.error);
    } catch {
      setStorageError(
        "브라우저 저장소에 접근하지 못했어요. 설정을 확인한 뒤 다시 불러와 주세요.",
      );
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    queueMicrotask(reloadSaved);
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) reloadSaved();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [reloadSaved]);

  const handleKeep = () => {
    if (!numbers || !context || !loaded) return;
    try {
      const result = addSavedNumber(window.localStorage, {
        id: crypto.randomUUID(),
        numbers: [...numbers],
        savedAt: Date.now(),
        targetEpisode: context.targetEpisode,
        conditions: context.conditions.map((c) => ({ ...c })),
      });
      if (!result.ok) {
        setNotice({ error: true, text: result.error });
        return;
      }
      setSaved(result.items);
      setNotice({ error: false, text: "번호를 이 브라우저에 저장했어요." });
      trackLottoEvent({ name: "save_complete" });
    } catch {
      setNotice({
        error: true,
        text: "번호를 저장하지 못했어요. 브라우저 저장소 설정을 확인해 주세요.",
      });
    }
  };
  const handleRemove = (id: string) => {
    try {
      const result = deleteSavedNumber(window.localStorage, id);
      if (!result.ok) {
        setNotice({ error: true, text: result.error });
        return;
      }
      setSaved(result.items);
      setNotice({ error: false, text: "선택한 저장 번호를 삭제했어요." });
      const index = saved.findIndex((item) => item.id === id);
      const next =
        result.items[Math.min(Math.max(index, 0), result.items.length - 1)];
      requestAnimationFrame(() => {
        document
          .getElementById(
            next ? `saved-delete-${next.id}` : "saved-numbers-heading",
          )
          ?.focus({ preventScroll: true });
      });
    } catch {
      setNotice({
        error: true,
        text: "번호를 삭제하지 못했어요. 기존 기록은 유지돼요.",
      });
    }
  };
  const handleCopy = async (values: number[], source: "result" | "saved") => {
    const result = await copyNumbers(
      values,
      navigator.clipboard?.writeText.bind(navigator.clipboard),
    );
    setNotice(result);
    if (!result.error) trackLottoEvent({ name: "copy_complete", source });
  };

  return (
    <section id="lotto-result" className="mt-8 scroll-mt-6 space-y-3">
      <div>
        <span className="text-primary font-mono text-[10px] tracking-[0.15em]">
          A LITTLE POSSIBILITY
        </span>
        <h2 className="mt-1 text-xl font-bold tracking-tight">
          이번 주 나의 번호
        </h2>
      </div>
      <div
        className="bg-background overflow-hidden rounded-2xl border"
        aria-live="polite"
      >
        <div className="text-muted-foreground flex flex-wrap justify-between gap-2 border-b border-dashed px-4 py-3 text-xs">
          <span className="text-primary font-mono tracking-widest">
            MY LOTTO TICKET
          </span>
          <span>
            {numbers && context
              ? episodeLabel(context.targetEpisode)
              : "아직 작성하지 않은 티켓"}
          </span>
        </div>
        <div className="bg-muted p-4 min-[480px]:p-5">
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {!error && numbers && (
            <>
              <div
                className="flex items-center justify-between gap-1.5"
                aria-label={`생성 번호 ${numbers.join(", ")}`}
              >
                {numbers.map((n, i) => (
                  <LottoBall
                    key={`${numbers.join("-")}-${n}`}
                    number={n}
                    size="lg"
                    className="lotto-ball-enter"
                    style={{ animationDelay: `${i * 0.06}s` }}
                  />
                ))}
              </div>
              <p className="text-muted-foreground mt-4 text-xs leading-5">
                적용 조건:{" "}
                {context?.conditions.length
                  ? context.conditions.map(conditionLabel).join(" · ")
                  : "조건 없이 생성"}
              </p>
              <div className="mt-4 flex justify-center gap-2 border-t border-dashed pt-4">
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={handleKeep}
                  disabled={!loaded || !!storageError}
                >
                  번호 저장
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void handleCopy(numbers, "result")}
                >
                  번호 복사
                </Button>
              </div>
            </>
          )}
          {!error && !numbers && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              아래 버튼을 눌러 나만의 티켓을 만들어 보세요.
            </p>
          )}
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {notice && (
          <p
            role={notice.error ? "alert" : "status"}
            className={`text-sm ${notice.error ? "text-destructive" : "text-primary"}`}
          >
            {notice.text}
          </p>
        )}
      </div>
      <div className="space-y-3">
        <div className="mt-8 flex items-center justify-between gap-2">
          <h2
            id="saved-numbers-heading"
            tabIndex={-1}
            className="text-xl font-bold tracking-tight"
          >
            저장한 번호
          </h2>
          <span className="text-muted-foreground text-xs">
            {saved.length}/{MAX_SAVED}개
          </span>
        </div>
        <p className="text-muted-foreground text-xs leading-5">
          이 기기·브라우저에만 저장돼요. 브라우저 데이터를 지우면 기록도
          사라져요. 최대 10개이며 기존 번호는 자동 삭제하지 않아요.
        </p>
        {storageError && (
          <div className="border-destructive/30 rounded-xl border p-3">
            <p role="alert" className="text-destructive text-sm">
              {storageError}
            </p>
            <Button
              variant="outline"
              className="mt-2 min-h-11"
              onClick={reloadSaved}
            >
              저장 기록 다시 불러오기
            </Button>
          </div>
        )}
        {!loaded ? (
          <p role="status" className="text-muted-foreground text-sm">
            저장 기록을 불러오고 있어요.
          </p>
        ) : saved.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {storageError
              ? "표시할 수 있는 저장 기록이 없어요."
              : "저장한 번호가 없어요."}
          </p>
        ) : (
          <ul className="space-y-3">
            {saved.map((item, index) => (
              <li
                key={item.id}
                className="bg-background space-y-3 rounded-xl border p-3"
              >
                <div className="text-muted-foreground flex flex-wrap justify-between gap-2 text-xs">
                  <span>{episodeLabel(item.targetEpisode)}</span>
                  <span>저장 {formatSavedAt(item.savedAt)}</span>
                </div>
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  aria-label={`저장 번호 ${item.numbers.join(", ")}`}
                >
                  {item.numbers.map((n) => (
                    <LottoBall key={n} number={n} size="sm" />
                  ))}
                </div>
                <p className="text-muted-foreground text-xs leading-5">
                  조건:{" "}
                  {item.conditions.length
                    ? item.conditions.map(conditionLabel).join(" · ")
                    : item.id.startsWith("legacy-")
                      ? "기존 기록 · 조건 정보 없음"
                      : "조건 없이 생성"}
                </p>
                <div className="flex justify-end gap-2 border-t border-dashed pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    aria-label={`${index + 1}번째 저장 번호 복사`}
                    onClick={() => void handleCopy(item.numbers, "saved")}
                  >
                    복사
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground min-h-11"
                    aria-label={`${index + 1}번째 저장 번호 삭제`}
                    id={`saved-delete-${item.id}`}
                    disabled={!!storageError}
                    onClick={() => handleRemove(item.id)}
                  >
                    삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
