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

export default function IncludeLuckyNumberOption() {
  const id = "include-lucky-number" as const;
  const label = "행운의 번호 포함";
  const checked = useLottoStore((s) => s.checked[id]);
  const luckyNumber = useLottoStore((s) => s.luckyNumber);
  const setChecked = useLottoStore((s) => s.setChecked);
  const setLuckyNumber = useLottoStore((s) => s.setLuckyNumber);
  const [open, setOpen] = useState(false);

  const canConfirm =
    luckyNumber != null && luckyNumber >= 1 && luckyNumber <= 45;

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
        valueLabel={luckyNumber != null ? `번호 ${luckyNumber}` : null}
      />
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label
              htmlFor="dialog-lucky"
              className="text-muted-foreground text-sm"
            >
              1~45 번호
            </label>
            <input
              id="dialog-lucky"
              type="number"
              min={1}
              max={45}
              value={luckyNumber ?? ""}
              onChange={(e) => {
                const n =
                  e.target.value === "" ? null : parseInt(e.target.value, 10);
                setLuckyNumber(
                  n == null || Number.isNaN(n)
                    ? null
                    : Math.min(45, Math.max(1, n)),
                );
              }}
              placeholder="번호 입력"
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
