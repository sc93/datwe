import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addSavedNumber,
  deleteSavedNumber,
  loadSavedNumbers,
  type SavedNumber,
  STORAGE_KEY,
} from "../src/app/(home)/_lib/saved-numbers";
const numbers = [1, 8, 15, 22, 34, 41];
const item = (id = "a"): SavedNumber => ({
  id,
  numbers,
  savedAt: 1234,
  targetEpisode: null,
  conditions: [],
});
function storage(raw: string | null = null) {
  return {
    raw,
    getItem(key: string) {
      assert.equal(key, STORAGE_KEY);
      return this.raw;
    },
    setItem(key: string, value: string) {
      assert.equal(key, STORAGE_KEY);
      this.raw = value;
    },
  };
}
test("기존 번호 배열과 번호·시간 레코드는 정상 데이터를 보존해 읽는다", () => {
  const store = storage(JSON.stringify([numbers, { numbers, savedAt: 4567 }]));
  const before = store.raw;
  const result = loadSavedNumbers(store);
  assert.equal(result.error, null);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items[0].numbers, numbers);
  assert.equal(result.items[0].savedAt, 0);
  assert.equal(result.items[1].savedAt, 4567);
  assert.equal(result.items[1].targetEpisode, null);
  assert.equal(store.raw, before);
});
test("손상 데이터는 표시 가능한 기록만 복구하고 원문을 덮어쓰지 않는다", () => {
  for (const raw of [
    "{",
    "{}",
    JSON.stringify([item(), { numbers: [1, 1, 2, 3, 4, 5], savedAt: 10 }]),
  ]) {
    const store = storage(raw);
    const result = loadSavedNumbers(store);
    assert.ok(result.error);
    assert.equal(addSavedNumber(store, item("b")).ok, false);
    assert.equal(store.raw, raw);
  }
});
test("최대 10개·중복 저장은 기존 기록을 자동 삭제하지 않는다", () => {
  const records = Array.from({ length: 10 }, (_, i) => ({
    ...item(String(i)),
    numbers: [i + 1, 20, 25, 30, 40, 45],
  }));
  const store = storage(JSON.stringify(records));
  assert.equal(
    addSavedNumber(store, { ...item("new"), numbers: [2, 3, 4, 5, 6, 7] }).ok,
    false,
  );
  assert.equal(loadSavedNumbers(store).items.length, 10);
  const before = store.raw;
  assert.equal(addSavedNumber(store, records[0]).ok, false);
  assert.equal(store.raw, before);
});
test("저장소 접근·쓰기 실패는 성공으로 반환하지 않는다", () => {
  const denied = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  assert.ok(loadSavedNumbers(denied).error);
  assert.equal(addSavedNumber(denied, item()).ok, false);
  const failWrite = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("quota");
    },
  };
  assert.equal(addSavedNumber(failWrite, item()).ok, false);
});
test("새 레코드는 조건과 대상 회차를 보존하고 개별 삭제를 저장한다", () => {
  const store = storage();
  const record: SavedNumber = {
    ...item(),
    targetEpisode: 1248,
    conditions: [{ id: "boss-name-exclusion", value: 7 }],
  };
  assert.equal(addSavedNumber(store, record).ok, true);
  assert.deepEqual(loadSavedNumbers(store).items, [record]);
  assert.equal(deleteSavedNumber(store, "a").ok, true);
  assert.equal(loadSavedNumbers(store).items.length, 0);
});
test("삭제 쓰기 실패와 다중 탭 변경에서도 기존 저장 데이터를 유지한다", () => {
  const store = storage(JSON.stringify([item()]));
  addSavedNumber(store, { ...item("b"), numbers: [2, 9, 16, 23, 35, 42] });
  const result = deleteSavedNumber(store, "a");
  assert.equal(result.ok, true);
  assert.deepEqual(
    loadSavedNumbers(store).items.map((i) => i.id),
    ["b"],
  );
  const failed = {
    getItem() {
      return JSON.stringify([item()]);
    },
    setItem() {
      throw new Error("quota");
    },
  };
  assert.equal(deleteSavedNumber(failed, "a").ok, false);
});

test("기존 10개 초과 기록도 자르지 않고 그대로 표시하고 보존한다", () => {
  const records = Array.from({ length: 11 }, (_, i) => ({
    ...item(String(i)),
    numbers: [i + 1, 20, 25, 30, 40, 45],
  }));
  const store = storage(JSON.stringify(records));
  const before = store.raw;
  assert.equal(loadSavedNumbers(store).items.length, 11);
  assert.equal(
    addSavedNumber(store, { ...item("new"), numbers: [1, 2, 3, 4, 5, 6] }).ok,
    false,
  );
  assert.equal(store.raw, before);
});
test("저장 시 허용한 숫자 조건 필드만 남기고 이름 원문을 버린다", () => {
  const store = storage();
  const incoming = {
    ...item(),
    bossName: "원문",
    conditions: [
      { id: "boss-name-exclusion" as const, value: 7, bossName: "원문" },
    ],
  };
  assert.equal(addSavedNumber(store, incoming).ok, true);
  assert.doesNotMatch(store.raw ?? "", /원문|bossName/);
});
