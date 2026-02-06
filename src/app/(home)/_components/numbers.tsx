"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { useLottoStore } from "../_store/lotto-store";

const STORAGE_KEY = "datwe-saved-numbers";
const MAX_SAVED = 10;

type SavedItem = { numbers: number[]; savedAt: number };

const BALL_COLORS = [
  "bg-amber-500 text-white",
  "bg-blue-600 text-white",
  "bg-rose-600 text-white",
  "bg-emerald-600 text-white",
  "bg-violet-600 text-white",
  "bg-zinc-800 text-white",
];

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
    <section className="mt-8 space-y-3">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes lotto-ball-bounce {
              0%, 100% { transform: translateY(0); }
              45% { transform: translateY(-20px); }
              75% { transform: translateY(-4px); }
            }
            .lotto-ball-bounce {
              animation: lotto-ball-bounce 0.5s ease-out both;
            }
          `,
        }}
      />
      <h2 className="text-sm font-medium text-zinc-700">생성 결과</h2>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {!error && numbers && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {numbers.map((n, i) => (
              <span
                key={`${n}-${i}`}
                className={`lotto-ball-bounce inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold tabular-nums shadow-sm ${BALL_COLORS[i % BALL_COLORS.length]}`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {n}
              </span>
            ))}
          </div>
        )}

        {!error && !numbers && (
          <p className="text-sm text-zinc-500">
            조건을 선택한 뒤 아래 버튼으로 번호를 생성해 보세요.
          </p>
        )}
        {!error && numbers && (
          <Button
            variant="outline"
            className="mx-auto mt-4 block h-fit"
            onClick={handleKeep}
          >
            킵하기
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-700">저장한 번호</h2>
        {saved.length === 0 ? (
          <p className="text-sm text-zinc-500">저장한 번호가 없어요.</p>
        ) : (
          <ul className="space-y-3">
            {saved.map((item, idx) => (
              <li
                key={`${idx}-${item.numbers.join("-")}-${item.savedAt}`}
                className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {item.numbers.map((n, i) => (
                      <span
                        key={`${n}-${i}`}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold tabular-nums shadow-sm ${BALL_COLORS[i % BALL_COLORS.length]}`}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={() => handleRemove(idx)}
                  >
                    제거
                  </Button>
                </div>
                {item.savedAt > 0 && (
                  <p className="text-xs text-zinc-500">
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
