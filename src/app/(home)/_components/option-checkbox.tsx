"use client";

import { Button } from "@/components/ui/button";

export default function OptionCheckbox({
  id,
  label,
  checked,
  onCheckedChange,
  opensDialog,
  onOpenDialog,
  valueLabel,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** true면 클릭 시 토글이 아니라 onOpenDialog 호출 (Dialog에서 입력 완료 후에만 활성화) */
  opensDialog?: boolean;
  onOpenDialog?: () => void;
  /** 모달에서 입력한 값 (체크된 경우에만 표시) */
  valueLabel?: string | null;
}) {
  const handleClick = () => {
    if (opensDialog && onOpenDialog) {
      if (checked) {
        onCheckedChange(false);
      } else {
        onOpenDialog();
      }
      return;
    }
    onCheckedChange(!checked);
  };

  return (
    <Button
      id={id}
      variant={checked ? "default" : "outline"}
      onClick={handleClick}
      aria-pressed={checked}
      aria-haspopup={opensDialog ? "dialog" : undefined}
      className="flex h-auto min-h-20 w-full min-w-0 flex-col gap-1 rounded-xl px-2 py-3 text-[11px] min-[480px]:text-sm"
    >
      <span className="text-center leading-5 break-keep whitespace-normal">
        {label}
      </span>
      {valueLabel && (
        <span className="max-w-full text-center text-[10px] leading-4 whitespace-normal opacity-90">
          {valueLabel}
        </span>
      )}
    </Button>
  );
}
