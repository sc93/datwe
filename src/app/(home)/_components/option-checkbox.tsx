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
      className="flex h-20 w-full flex-col gap-0.5 overflow-hidden py-5"
    >
      <span className="whitespace-pre-line">{label}</span>
      {valueLabel && (
        <span className="line-clamp-1 text-xs opacity-90">{valueLabel}</span>
      )}
    </Button>
  );
}
