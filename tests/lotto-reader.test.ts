import assert from "node:assert/strict";
import test from "node:test";

import {
  CACHE_SECONDS,
  IncompleteLottoDataError,
  loadLottoData,
  readLottoData,
  requireCompleteLottoData,
} from "../src/lib/lotto-reader";
import { completeData, response } from "./lotto-fixtures";

const checkedAt = "2026-10-28T00:00:00.000Z";
const options = { now: () => Date.parse(checkedAt) };
const goodFetch: typeof fetch = async (input) => {
  const episode =
    Number(new URL(String(input)).searchParams.get("srchLtEpsd")) || 1247;
  return Response.json(response(episode));
};
test("최신 조회를 재사용해 5번의 요청으로 정확한 최신 5회를 내림차순 제공한다", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push(String(input));
    return goodFetch(input, init);
  };
  const data = await loadLottoData(fetcher, options);
  assert.deepEqual(data, completeData());
  assert.equal(calls.length, 5);
  assert.deepEqual(
    data.draws.map((d) => d.episode),
    [1247, 1246, 1245, 1244, 1243],
  );
});
test("일부 실패는 회차를 압축하거나 중복으로 채우지 않고 누락 회차를 반환한다", async () => {
  const fetcher: typeof fetch = async (input, init) =>
    String(input).endsWith("=1245")
      ? new Response(null, { status: 500 })
      : goodFetch(input, init);
  const data = await loadLottoData(fetcher, options);
  assert.equal(data.status, "partial");
  assert.deepEqual(data.missingEpisodes, [1245]);
  assert.equal(data.draws.length, 4);
  const duplicated = await loadLottoData(
    async () => Response.json(response()),
    options,
  );
  assert.equal(duplicated.status, "partial");
  assert.deepEqual(
    duplicated.draws.map((d) => d.episode),
    [1247],
  );
});
test("최신 조회 실패·JSON 오류에서는 과거 회차를 최신으로 대체하지 않는다", async () => {
  for (const fetcher of [
    async () => new Response(null, { status: 503 }),
    async () => new Response("<html>blocked</html>"),
    async () => {
      throw new Error("offline");
    },
  ]) {
    const data = await loadLottoData(fetcher, options);
    assert.equal(data.status, "unavailable");
    assert.equal(data.latestEpisode, null);
    assert.deepEqual(data.draws, []);
  }
});
test("응답이 끝나지 않는 요청은 타임아웃 신호로 중단한다", async () => {
  let aborted = false;
  const fetcher: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("timeout not enforced")),
        1000,
      );
      init?.signal?.addEventListener(
        "abort",
        () => {
          aborted = true;
          clearTimeout(timer);
          reject(new Error("aborted"));
        },
        { once: true },
      );
    });
  const data = await loadLottoData(fetcher, { ...options, timeoutMs: 5 });
  assert.equal(aborted, true);
  assert.equal(data.status, "unavailable");
});
test("부분 실패는 정상 스냅샷 캐시에 기록하지 않도록 오류로 반환한다", async () => {
  await assert.rejects(
    requireCompleteLottoData(async () => Response.json(response()), options),
    (error: unknown) =>
      error instanceof IncompleteLottoDataError &&
      error.data.status === "partial",
  );
});
test("마지막 정상 캐시의 확인 시각은 유지하며 TTL이 지나면 stale로 구분한다", async () => {
  const snapshot = completeData();
  assert.equal(
    (
      await readLottoData(
        async () => snapshot,
        () => Date.parse(checkedAt) + 1000,
      )
    ).status,
    "fresh",
  );
  const stale = await readLottoData(
    async () => snapshot,
    () => Date.parse(checkedAt) + CACHE_SECONDS * 1000,
  );
  assert.equal(stale.status, "stale");
  assert.equal(stale.checkedAt, checkedAt);
  assert.deepEqual(stale.draws, snapshot.draws);
});
test("캐시 첫 채움의 부분 응답과 캐시 자체의 실패를 구분한다", async () => {
  const partial = {
    ...completeData(),
    status: "partial" as const,
    draws: [completeData().draws[0]],
    missingEpisodes: [1246, 1245, 1244, 1243],
  };
  assert.deepEqual(
    await readLottoData(async () => {
      throw new IncompleteLottoDataError(partial);
    }),
    partial,
  );
  assert.equal(
    (
      await readLottoData(async () => {
        throw new Error("cache offline");
      })
    ).status,
    "unavailable",
  );
});
