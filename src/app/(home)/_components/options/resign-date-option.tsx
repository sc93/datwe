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

export default function ResignDateOption() {
  const id = "resign-date-hash" as const;
  const label = "희망 퇴사일 포함";
  const checked = useLottoStore((s) => s.checked[id]);
  const resignDay = useLottoStore((s) => s.resignDay);
  const setChecked = useLottoStore((s) => s.setChecked);
  const setResignDay = useLottoStore((s) => s.setResignDay);
  const [open, setOpen] = useState(false);

  const canConfirm = resignDay != null && resignDay >= 1 && resignDay <= 31;

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
        valueLabel={resignDay != null ? `${resignDay}일` : null}
      />
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label
              htmlFor="dialog-resign"
              className="text-muted-foreground text-sm"
            >
              1~31 일
            </label>
            <input
              id="dialog-resign"
              type="number"
              min={1}
              max={31}
              value={resignDay ?? ""}
              onChange={(e) => {
                const n =
                  e.target.value === "" ? null : parseInt(e.target.value, 10);
                setResignDay(
                  n == null || Number.isNaN(n)
                    ? null
                    : Math.min(31, Math.max(1, n)),
                );
              }}
              placeholder="일"
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
