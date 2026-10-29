import assert from "node:assert/strict";
import test from "node:test";

import { createDrawReader, type DrawCache } from "../src/lib/draw-reader";
import { response } from "./lotto-fixtures";

const time = Date.parse("2026-10-29T00:00:00Z");
const goodFetch: typeof fetch = async (input) => {
  const n =
    Number(new URL(String(input)).searchParams.get("srchLtEpsd")) || 1247;
  return Response.json(response(n));
};

test("최신 목록은 20개 슬롯만 조회하고 최신 응답을 재사용한다", async () => {
  const calls: string[] = [];
  const reader = createDrawReader({
    now: () => time,
    fetcher: async (input, init) => {
      calls.push(String(input));
      return goodFetch(input, init);
    },
  });
  const result = await reader.readRange();
  assert.equal(result.status, "fresh");
  assert.equal(result.to, 1247);
  assert.equal(result.from, 1228);
  assert.equal(result.slots.length, 20);
  assert.equal(result.slots[0].draw?.episode, 1247);
  assert.equal(result.slots[19].draw?.episode, 1228);
  assert.equal(calls.length, 20);
  assert.equal(
    calls.some((url) => url.endsWith("=1227")),
    false,
  );
});

test("1회와 마지막 20개 미만 구간은 0회 이하를 조회하지 않는다", async () => {
  const reader = createDrawReader({ fetcher: goodFetch });
  const first = await reader.readRange(1);
  assert.equal(first.slots.length, 1);
  assert.equal(first.from, 1);
  const short = await reader.readRange(7);
  assert.deepEqual(
    short.slots.map((s) => s.episode),
    [7, 6, 5, 4, 3, 2, 1],
  );
  const history = await reader.readPrevious(1);
  assert.equal(history.slots.length, 0);
  assert.equal(history.status, "insufficient-history");
});

test("잘못된 범위는 조회하지 않으며 확인된 최신 상한을 넘지 않는다", async () => {
  const calls: string[] = [];
  const reader = createDrawReader({
    fetcher: async (url, init) => {
      calls.push(String(url));
      return goodFetch(url, init);
    },
  });
  for (const n of [0, -1, 1.5, NaN, Infinity]) {
    assert.equal((await reader.readRange(n)).status, "invalid-range");
    assert.equal((await reader.readDraw(n)).status, "invalid-range");
  }
  assert.equal(calls.length, 0);
  assert.equal((await reader.readRange(1248)).status, "invalid-range");
  assert.equal(calls.length, 1);
});

test("실패 슬롯은 원래 회차에 남으며 빈 응답과 전체 실패를 구분한다", async () => {
  const reader = createDrawReader({
    fetcher: async (url, init) => {
      if (String(url).endsWith("=6"))
        return new Response(null, { status: 503 });
      if (String(url).endsWith("=5"))
        return Response.json({ data: { list: [] } });
      return goodFetch(url, init);
    },
  });
  const result = await reader.readRange(7);
  assert.equal(result.status, "partial");
  assert.deepEqual(result.missingEpisodes, [6, 5]);
  assert.equal(result.slots[1].episode, 6);
  assert.equal(result.slots[1].status, "unavailable");
  assert.equal(result.slots[2].status, "empty");
  const empty = createDrawReader({
    fetcher: async () => Response.json({ data: { list: [] } }),
  });
  assert.equal((await empty.readRange(7)).status, "empty");
  const failed = createDrawReader({
    fetcher: async () => new Response(null, { status: 503 }),
  });
  assert.equal((await failed.readRange(7)).status, "unavailable");
  assert.equal((await failed.readRange()).status, "latest-unknown");
  assert.equal((await failed.readDraw(600)).status, "unavailable");
});

test("회차 불일치·손상 응답은 정상 데이터로 캐시하지 않는다", async () => {
  for (const payload of [
    response(8),
    { data: { list: [{ ...response(7).data.list[0], tm2WnNo: 8 }] } },
    { data: { list: [{ ...response(7).data.list[0], bnsWnNo: 8 }] } },
    { data: { list: [{ ...response(7).data.list[0], ltRflYmd: "20260230" }] } },
  ]) {
    const reader = createDrawReader({
      fetcher: async () => Response.json(payload),
    });
    const result = await reader.readDraw(7);
    assert.equal(result.status, "unavailable");
    assert.equal(result.failure, "invalid-response");
    assert.equal(result.draw, null);
  }
});

test("동시 요청을 3개로 제한하고 같은 대상·의존 회차 요청을 공유한다", async () => {
  let active = 0,
    max = 0;
  const calls: number[] = [];
  const reader = createDrawReader({
    fetcher: async (url, init) => {
      const n = Number(new URL(String(url)).searchParams.get("srchLtEpsd"));
      calls.push(n);
      active++;
      max = Math.max(max, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return goodFetch(url, init);
    },
  });
  const [target, history, other] = await Promise.all([
    reader.readDraw(100),
    reader.readPrevious(101),
    reader.readPrevious(100),
  ]);
  assert.equal(target.draw?.episode, 100);
  assert.equal(history.slots.length, 5);
  assert.equal(other.slots.length, 5);
  assert.equal(calls.length, 6);
  assert.equal(max <= 3, true);
});

test("최신 미확인 시에도 과거 단건은 조회하고 상세 의존 실패를 분리한다", async () => {
  const reader = createDrawReader({
    fetcher: async (url, init) =>
      String(url).endsWith("=99")
        ? new Response(null, { status: 503 })
        : goodFetch(url, init),
  });
  const target = await reader.readDraw(100);
  const previous = await reader.readPrevious(100);
  assert.equal(target.status, "fresh");
  assert.equal(previous.status, "partial");
  assert.deepEqual(previous.missingEpisodes, [99]);
  assert.deepEqual(
    previous.slots.map((s) => s.episode),
    [99, 98, 97, 96, 95],
  );
});

test("캐시는 최신5분·과거24시간이며 만료 후 실패로 정상 기록을 덮지 않는다", async () => {
  let clock = time,
    fail = false;
  const entries = new Map<string, { value: unknown; expires: number }>();
  const cache: DrawCache = async (key, ttl, load) => {
    const old = entries.get(key);
    if (old && old.expires > clock)
      return old.value as Awaited<ReturnType<typeof load>>;
    try {
      const value = await load();
      entries.set(key, { value, expires: clock + ttl * 1000 });
      return value;
    } catch (error) {
      if (old) return old.value as Awaited<ReturnType<typeof load>>;
      throw error;
    }
  };
  let calls = 0;
  const reader = createDrawReader({
    cache,
    now: () => clock,
    fetcher: async (url, init) => {
      calls++;
      return fail ? new Response(null, { status: 503 }) : goodFetch(url, init);
    },
  });
  const first = await reader.readDraw(100);
  const latest = await reader.readLatest();
  assert.equal(calls, 2);
  clock += 300_000;
  fail = true;
  const staleLatest = await reader.readLatest();
  assert.equal(staleLatest.status, "stale");
  assert.equal(staleLatest.checkedAt, latest.checkedAt);
  assert.equal((await reader.readDraw(100)).status, "fresh");
  assert.equal(calls, 3);
  clock = time + 86_400_000;
  const stale = await reader.readDraw(100);
  assert.equal(stale.status, "stale");
  assert.equal(stale.checkedAt, first.checkedAt);
  assert.equal(stale.draw?.episode, 100);
});

test("응답 본문 타임아웃과 개별 취소는 실패·새 결과와 구분한다", async () => {
  const reader = createDrawReader({
    timeoutMs: 5,
    fetcher: async (_url, init) =>
      new Response(
        new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener(
              "abort",
              () => controller.error(new Error("aborted")),
              { once: true },
            );
          },
        }),
      ),
  });
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    assert.equal((await reader.readDraw(100)).failure, "timeout");
  } finally {
    clearTimeout(keepAlive);
  }
  const slow = createDrawReader({
    fetcher: async (url, init) => {
      await new Promise((r) => setTimeout(r, 10));
      return goodFetch(url, init);
    },
  });
  const controller = new AbortController();
  const old = slow.readDraw(100, { signal: controller.signal });
  const shared = slow.readDraw(100);
  controller.abort();
  const current = slow.readDraw(101);
  assert.equal((await old).status, "cancelled");
  assert.equal((await current).draw?.episode, 101);
  assert.equal((await shared).draw?.episode, 100);
});

test("실패 코드가 있는 빈 원천 응답은 정상 0건으로 표시하지 않는다", async () => {
  const reader = createDrawReader({
    fetcher: async () =>
      Response.json({ resultCode: "ERROR", data: { list: [] } }),
  });
  const result = await reader.readDraw(600);
  assert.equal(result.status, "unavailable");
  assert.equal(result.failure, "invalid-response");
});

test("실패와 0건은 캐시에 넣지 않고 다음 독립 재시도에서 복구한다", async () => {
  let attempts = 0,
    writes = 0;
  const reader = createDrawReader({
    fetcher: async () =>
      ++attempts === 1
        ? Response.json({ data: { list: [] } })
        : Response.json(response(600)),
    cache: async (_key, _ttl, load) => {
      const value = await load();
      writes++;
      return value;
    },
  });
  assert.equal((await reader.readDraw(600)).status, "empty");
  assert.equal(writes, 0);
  assert.equal((await reader.readDraw(600)).draw?.episode, 600);
  assert.equal(writes, 1);
});

test("취소된 구간은 새 결과가 되지 않고 추가 대기 회차를 요청하지 않는다", async () => {
  let calls = 0;
  const controller = new AbortController();
  const reader = createDrawReader({
    fetcher: async (url, init) => {
      calls++;
      if (String(url).endsWith("=1247"))
        throw new Error("latest should be reused");
      if (!String(url).endsWith("="))
        await new Promise((r) => setTimeout(r, 10));
      return goodFetch(url, init);
    },
  });
  const old = reader.readRange(undefined, { signal: controller.signal });
  await new Promise((r) => setTimeout(r, 2));
  controller.abort();
  assert.equal((await old).status, "cancelled");
  assert.equal(calls <= 4, true);
});

test("오래된 캐시를 즉시 반환하는 동안 같은 회차의 백그라운드 원천 요청도 공유한다", async () => {
  let requests = 0;
  const background: Promise<unknown>[] = [];
  const reader = createDrawReader({
    now: () => time,
    cache: async (_key, _ttl, load) => {
      background.push(load().catch(() => null));
      return {
        draw: {
          episode: 600,
          drawDate: "2014-05-31",
          numbers: [5, 11, 14, 27, 29, 36],
          bonus: 44,
        },
        checkedAt: "2026-10-27T00:00:00Z",
        sourceUrl:
          "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=600",
      };
    },
    fetcher: async (url, init) => {
      requests++;
      await new Promise((r) => setTimeout(r, 10));
      return goodFetch(url, init);
    },
  });
  assert.equal((await reader.readDraw(600)).status, "stale");
  assert.equal((await reader.readDraw(600)).status, "stale");
  await Promise.all(background);
  assert.equal(requests, 1);
});
