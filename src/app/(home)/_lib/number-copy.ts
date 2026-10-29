export async function copyNumbers(
  numbers: number[],
  writeText: ((value: string) => Promise<void>) | undefined,
): Promise<{ error: boolean; text: string }> {
  try {
    if (!writeText) throw new Error("unsupported");
    await writeText(numbers.join(", "));
    return { error: false, text: "번호 6개를 복사했어요." };
  } catch {
    return {
      error: true,
      text: "복사하지 못했어요. 클립보드 권한을 확인하고 다시 시도하거나 번호를 직접 선택해 주세요.",
    };
  }
}
