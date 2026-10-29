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

export default function CarryOverOption() {
  const id = "carry-over-one" as const;
  const label = "이월수 1개 포함";
  const checked = useLottoStore((s) => s.checked[id]);
  const recentDraws = useLottoStore((s) => s.recentDraws);
  const available = useLottoStore((s) => s.canUseCarryOver);
  const carryOverNumber = useLottoStore((s) => s.carryOverNumber);
  const setChecked = useLottoStore((s) => s.setChecked);
  const setCarryOverNumber = useLottoStore((s) => s.setCarryOverNumber);
  const [open, setOpen] = useState(false);

  const lastDraw =
    recentDraws.length > 0 ? recentDraws[recentDraws.length - 1] : [];

  const handleSelect = (n: number) => {
    setCarryOverNumber(n);
    setChecked(id, true);
    setOpen(false);
  };

  return (
    <>
      <OptionCheckbox
        disabled={!available && !checked}
        id={id}
        label={label}
        checked={checked}
        onCheckedChange={(v) => setChecked(id, v)}
        opensDialog
        onOpenDialog={() => setOpen(true)}
        valueLabel={
          !available
            ? "직전 회차 확인 필요"
            : carryOverNumber != null
              ? `직전 회차 번호 ${carryOverNumber}`
              : null
        }
      />
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          {lastDraw.length === 0 ? (
            <p className="text-sm text-zinc-500">
              직전 회차 정보가 없어 이월수를 선택할 수 없습니다.
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm text-zinc-600">
                직전 회차 번호 중에서 이월로 가져올 번호를 선택해 주세요.
              </p>
              <div className="flex flex-wrap gap-2">
                {lastDraw.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={carryOverNumber === n ? "default" : "outline"}
                    className="size-11 rounded-full p-0 text-sm"
                    onClick={() => handleSelect(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </>
          )}
          {available && (
            <Button
              variant="outline"
              onClick={() => {
                setCarryOverNumber(null);
                setChecked(id, true);
                setOpen(false);
              }}
            >
              직전 본번호에서 자동으로 1개 선택
            </Button>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
              }}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
