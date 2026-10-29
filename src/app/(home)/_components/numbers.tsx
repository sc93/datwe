"use client";

import { useCallback, useEffect, useState } from "react";

import { LottoBall } from "@/components/lotto-ball";
import { Button } from "@/components/ui/button";

import { useLottoStore } from "../_store/lotto-store";

const STORAGE_KEY = "datwe-saved-numbers";
const MAX_SAVED = 10;

type SavedItem = { numbers: number[]; savedAt: number };

function isNumbersArray(item: unknown): item is number[] {
  return (
    Array.isArray(item) &&
    item.length === 6 &&
    item.every((n) => typeof n === "number")
  );
}

function loadSaved(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: unknown): SavedItem | null => {
        if (
          item !== null &&
          typeof item === "object" &&
          "numbers" in item &&
          Array.isArray((item as SavedItem).numbers)
        ) {
          const { numbers, savedAt } = item as SavedItem;
          if (numbers.length === 6 && typeof savedAt === "number")
            return { numbers, savedAt };
        }
        if (isNumbersArray(item)) return { numbers: item, savedAt: 0 };
        return null;
      })
      .filter((item): item is SavedItem => item !== null)
      .slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

function saveToStorage(items: SavedItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_SAVED)),
    );
  } catch {
    // ignore
  }
}

function formatSavedAt(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Numbers() {
  const numbers = useLottoStore((s) => s.numbers);
  const error = useLottoStore((s) => s.error);
  const [saved, setSaved] = useState<SavedItem[]>([]);

  useEffect(() => {
    const stored = loadSaved();
    queueMicrotask(() => setSaved(stored));
  }, []);

  const handleKeep = useCallback(() => {
    if (!numbers || numbers.length !== 6) return;
    const isDuplicate = saved.some(
      (s) =>
        s.numbers.length === numbers.length &&
        s.numbers.every((n, i) => n === numbers[i]),
    );
    if (isDuplicate) return;
    const newItem: SavedItem = { numbers: [...numbers], savedAt: Date.now() };
    const next = [newItem, ...saved].slice(0, MAX_SAVED);
    setSaved(next);
    saveToStorage(next);
  }, [numbers, saved]);

  const handleRemove = useCallback((index: number) => {
    setSaved((prev) => {
      const next = prev.filter((_, i) => i !== index);
      saveToStorage(next);
      return next;
    });
  }, []);

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
        className="bg-muted rounded-2xl border p-4 min-[480px]:p-5"
        aria-live="polite"
      >
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {!error && numbers && (
          <div className="flex items-center justify-between gap-1.5">
            {numbers.map((n, i) => (
              <LottoBall
                key={`${n}-${i}`}
                number={n}
                size="lg"
                className="lotto-ball-enter"
                style={{ animationDelay: `${i * 0.06}s` }}
              />
            ))}
          </div>
        )}

        {!error && !numbers && (
          <p className="text-muted-foreground text-sm">
            아래 버튼을 눌러 번호를 만들어 보세요.
          </p>
        )}
        {!error && numbers && (
          <Button
            variant="outline"
            className="mx-auto mt-4 flex min-h-11"
            onClick={handleKeep}
          >
            번호 저장
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <h2 className="mt-8 text-xl font-bold tracking-tight">저장한 번호</h2>
        {saved.length === 0 ? (
          <p className="text-muted-foreground text-sm">저장한 번호가 없어요.</p>
        ) : (
          <ul className="space-y-3">
            {saved.map((item, idx) => (
              <li
                key={`${idx}-${item.numbers.join("-")}-${item.savedAt}`}
                className="bg-background flex flex-col gap-2 rounded-xl border px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {item.numbers.map((n, i) => (
                      <LottoBall key={`${n}-${i}`} number={n} size="sm" />
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground ml-auto min-h-11 shrink-0"
                    onClick={() => handleRemove(idx)}
                  >
                    삭제
                  </Button>
                </div>
                {item.savedAt > 0 && (
                  <p className="text-muted-foreground text-xs">
                    저장 {formatSavedAt(item.savedAt)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
