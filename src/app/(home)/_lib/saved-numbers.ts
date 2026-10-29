import { LOTTO_OPTION_IDS, type LottoOptionId } from "./lotto-conditions";

export const STORAGE_KEY = "datwe-saved-numbers";
export const MAX_SAVED = 10;
export type ConditionSnapshot = { id: LottoOptionId; value: number | null };
export type SavedNumber = {
  id: string;
  numbers: number[];
  savedAt: number;
  targetEpisode: number | null;
  conditions: ConditionSnapshot[];
};
export type NumberStorage = Pick<Storage, "getItem" | "setItem">;
type Loaded = { items: SavedNumber[]; error: string | null };
type Mutation =
  | { ok: true; items: SavedNumber[] }
  | { ok: false; error: string };
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
function validNumbers(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 6 &&
    new Set(value).size === 6 &&
    value.every(
      (n) => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 45,
    )
  );
}
function parseConditions(value: unknown): ConditionSnapshot[] | null {
  if (!Array.isArray(value)) return null;
  const result: ConditionSnapshot[] = [];
  for (const entry of value) {
    const row = object(entry);
    if (
      !row ||
      !LOTTO_OPTION_IDS.includes(row.id as LottoOptionId) ||
      (row.value !== null &&
        (typeof row.value !== "number" ||
          !Number.isInteger(row.value) ||
          row.value < 0 ||
          row.value > 45))
    )
      return null;
    // 허용 필드만 재구성해 이름 원문 등 임의 필드를 저장하지 않는다.
    result.push({
      id: row.id as LottoOptionId,
      value: row.value as number | null,
    });
  }
  return new Set(result.map((c) => c.id)).size === result.length
    ? result
    : null;
}
function parseRecord(value: unknown, index: number): SavedNumber | null {
  if (validNumbers(value))
    return {
      id: `legacy-array-${index}-${value.join("-")}`,
      numbers: [...value],
      savedAt: 0,
      targetEpisode: null,
      conditions: [],
    };
  const row = object(value);
  if (
    !row ||
    !validNumbers(row.numbers) ||
    typeof row.savedAt !== "number" ||
    !Number.isFinite(row.savedAt) ||
    row.savedAt < 0 ||
    row.savedAt > 8640000000000000 - 9 * 60 * 60 * 1000
  )
    return null;
  const legacy =
    !("id" in row) && !("conditions" in row) && !("targetEpisode" in row);
  if (legacy)
    return {
      id: `legacy-${index}-${row.savedAt}-${row.numbers.join("-")}`,
      numbers: [...row.numbers],
      savedAt: row.savedAt,
      targetEpisode: null,
      conditions: [],
    };
  const conditions = parseConditions(row.conditions);
  if (
    typeof row.id !== "string" ||
    !row.id ||
    !conditions ||
    (row.targetEpisode !== null &&
      (typeof row.targetEpisode !== "number" ||
        !Number.isSafeInteger(row.targetEpisode) ||
        row.targetEpisode < 1))
  )
    return null;
  return {
    id: row.id,
    numbers: [...row.numbers],
    savedAt: row.savedAt,
    targetEpisode: row.targetEpisode as number | null,
    conditions,
  };
}
export function loadSavedNumbers(storage: NumberStorage): Loaded {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { items: [], error: null };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed))
      return {
        items: [],
        error:
          "저장 기록 형식을 읽지 못했어요. 기존 데이터를 보호하기 위해 저장·삭제를 멈췄어요.",
      };
    const items: SavedNumber[] = [];
    let damaged = false;
    for (const [index, entry] of parsed.entries()) {
      const item = parseRecord(entry, index);
      if (!item || items.some((existing) => existing.id === item.id)) {
        damaged = true;
        continue;
      }
      items.push(item);
    }
    return {
      items,
      error: damaged
        ? "일부 저장 기록을 읽지 못했어요. 정상 기록은 표시하며 원본 보호를 위해 저장·삭제를 멈췄어요."
        : null,
    };
  } catch {
    return {
      items: [],
      error:
        "저장 기록을 읽지 못했어요. 브라우저 저장소 설정을 확인한 뒤 다시 불러와 주세요.",
    };
  }
}
function persist(storage: NumberStorage, items: SavedNumber[]): Mutation {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
    return { ok: true, items };
  } catch {
    return {
      ok: false,
      error:
        "저장소에 반영하지 못했어요. 기존 기록은 유지돼요. 저장 공간과 브라우저 설정을 확인하고 다시 시도해 주세요.",
    };
  }
}
export function addSavedNumber(
  storage: NumberStorage,
  item: SavedNumber,
): Mutation {
  const current = loadSavedNumbers(storage);
  if (current.error) return { ok: false, error: current.error };
  const safe = parseRecord(item, 0);
  if (!safe)
    return { ok: false, error: "유효한 번호 기록만 저장할 수 있어요." };
  const key = (numbers: number[]) =>
    [...numbers].sort((a, b) => a - b).join(",");
  if (
    current.items.some(
      (existing) => key(existing.numbers) === key(safe.numbers),
    )
  )
    return { ok: false, error: "이미 저장한 번호예요." };
  if (current.items.length >= MAX_SAVED)
    return {
      ok: false,
      error:
        "최대 10개까지 저장할 수 있어요. 기존 기록을 직접 삭제한 뒤 다시 저장해 주세요.",
    };
  if (current.items.some((existing) => existing.id === safe.id))
    return { ok: false, error: "저장 식별자가 겹쳤어요. 다시 시도해 주세요." };
  return persist(storage, [safe, ...current.items]);
}
export function deleteSavedNumber(
  storage: NumberStorage,
  id: string,
): Mutation {
  const current = loadSavedNumbers(storage);
  if (current.error) return { ok: false, error: current.error };
  if (!current.items.some((item) => item.id === id))
    return {
      ok: false,
      error:
        "이미 삭제되었거나 다른 탭에서 변경된 기록이에요. 다시 불러와 주세요.",
    };
  return persist(
    storage,
    current.items.filter((item) => item.id !== id),
  );
}
