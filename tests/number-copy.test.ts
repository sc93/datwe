import assert from "node:assert/strict";
import { test } from "node:test";

import { copyNumbers } from "../src/app/(home)/_lib/number-copy";

test("번호 6개를 쉼표로 구분해 복사하고 완료 후에만 성공을 반환한다", async () => {
  let copied = "";
  const result = await copyNumbers([1, 8, 15, 22, 34, 41], async (value) => {
    copied = value;
  });
  assert.equal(copied, "1, 8, 15, 22, 34, 41");
  assert.equal(result.error, false);
});
test("클립보드 거부·미지원은 성공으로 안내하지 않는다", async () => {
  const failed = await copyNumbers([1, 8, 15, 22, 34, 41], async () => {
    throw new Error("denied");
  });
  assert.equal(failed.error, true);
  assert.match(failed.text, /다시 시도/);
  assert.equal(
    (await copyNumbers([1, 8, 15, 22, 34, 41], undefined)).error,
    true,
  );
});
