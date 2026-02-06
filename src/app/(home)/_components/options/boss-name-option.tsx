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

import { getStrokeCount } from "../../_lib/stroke-count";
import { useLottoStore } from "../../_store/lotto-store";
import OptionCheckbox from "../option-checkbox";

const inputClass =
  "border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 mt-2";

export default function BossNameOption() {
  const id = "boss-name-exclusion" as const;
  const label = "연인 이름 획수 포함";
  const checked = useLottoStore((s) => s.checked[id]);
  const bossName = useLottoStore((s) => s.bossName);
  const setChecked = useLottoStore((s) => s.setChecked);
  const setBossName = useLottoStore((s) => s.setBossName);
  const [open, setOpen] = useState(false);

  const canConfirm = typeof bossName === "string" && bossName.trim().length > 0;

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
        valueLabel={
          bossName?.trim()
            ? `${bossName} (${getStrokeCount(bossName.trim())}획)`
            : null
        }
      />
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label
              htmlFor="dialog-boss"
              className="text-muted-foreground text-sm"
            >
              연인은 있으시죠? 없으면 본인 이름이라도..
            </label>
            <input
              id="dialog-boss"
              type="text"
              value={bossName ?? ""}
              onChange={(e) => setBossName(e.target.value || null)}
              placeholder="이름 입력"
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
