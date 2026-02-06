"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useLottoStore } from "../../_store/lotto-store";
import OptionCheckbox from "../option-checkbox";

const inputClass =
  "border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 mt-2";

export default function OddEvenOption() {
  const id = "odd-even-balanced" as const;
  const label = "홀짝 비율";
  const checked = useLottoStore((s) => s.checked[id]);
  const oddCount = useLottoStore((s) => s.oddCount);
  const setChecked = useLottoStore((s) => s.setChecked);
  const setOddCount = useLottoStore((s) => s.setOddCount);
  const [open, setOpen] = useState(false);

  const canConfirm = oddCount != null && oddCount >= 0 && oddCount <= 6;

  const handleConfirm = () => {
    if (canConfirm) {
      setChecked(id, true);
      setOpen(false);
    }
  };

  return (
    <>
      <OptionCheckbox
        id={id}
        label={label}
        checked={checked}
        onCheckedChange={(v) => setChecked(id, v)}
        opensDialog
        onOpenDialog={() => setOpen(true)}
        valueLabel={oddCount != null ? `홀수 ${oddCount}개` : null}
      />
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label
              htmlFor="dialog-odd"
              className="text-muted-foreground text-sm"
            >
              홀수 개수 (0~6)
            </label>
            <input
              id="dialog-odd"
              type="number"
              min={0}
              max={6}
              value={oddCount ?? ""}
              onChange={(e) => {
                const n =
                  e.target.value === "" ? null : parseInt(e.target.value, 10);
                setOddCount(
                  n == null || Number.isNaN(n)
                    ? null
                    : Math.min(6, Math.max(0, n)),
                );
              }}
              placeholder="0~6"
              className={inputClass}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={handleConfirm} disabled={!canConfirm}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
