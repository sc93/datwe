import assert from "node:assert/strict";
import test from "node:test";

import {
  createDrawReader,
  type DrawCache,
  type DrawSnapshot,
} from "../src/lib/draw-reader";
import { draw } from "./lotto-fixtures";

const snapshot = (episode = 1247): DrawSnapshot => ({
  draw: draw(episode),
  checkedAt: "2026-10-29T00:00:00Z",
  sourceUrl: "https://www.dhlottery.co.kr/lt645/result",
});
const load = async (n?: number) => snapshot(n);
const reader = (
  options: Partial<Parameters<typeof createDrawReader>[0]> = {},
) => createDrawReader({ loadSnapshot: load, isFresh: () => true, ...options });

test("최신 목록은20개 슬롯만 읽고 최신 스냅샷을 재사용한다", async () => {
  const calls: (number | undefined)[] = [];
  const r = reader({
    loadSnapshot: async (n) => {
      calls.push(n);
      return load(n);
    },
  });
  const range = await r.readRange();
  assert.equal(range.status, "fresh");
  assert.equal(range.from, 1228);
  assert.equal(range.to, 1247);
  assert.equal(range.slots.length, 20);
  assert.equal(range.slots[19].episode, 1228);
  assert.equal(calls.length, 20);
  assert.ok(!calls.includes(1227));
});

test("초기 구간과 이전5회는 존재하는 회차만 읽으며 잘못된 입력은 조회하지 않는다", async () => {
  const calls: (number | undefined)[] = [];
  const r = reader({
    loadSnapshot: async (n) => {
      calls.push(n);
      return load(n);
    },
  });
  for (const n of [0, -1, 1.5, NaN, Infinity]) {
    assert.equal((await r.readDraw(n)).status, "invalid-range");
    assert.equal((await r.readRange(n)).status, "invalid-range");
  }
  assert.equal(calls.length, 0);
  assert.equal((await r.readRange(1248)).status, "invalid-range");
  assert.deepEqual(
    (await r.readRange(7)).slots.map((s) => s.episode),
    [7, 6, 5, 4, 3, 2, 1],
  );
  assert.equal((await r.readRange(1)).from, 1);
  assert.equal((await r.readPrevious(1)).status, "insufficient-history");
  assert.deepEqual(
    (await r.readPrevious(3)).slots.map((s) => s.episode),
    [2, 1],
  );
});

test("미수집·DB 장애를 원래 회차에 남기고 최신 미확인과 구분한다", async () => {
  const r = reader({
    loadSnapshot: async (n) => {
      if (n === 6) throw Error("private connection");
      return n === 5 ? null : load(n);
    },
  });
  const range = await r.readRange(7);
  assert.equal(range.status, "partial");
  assert.deepEqual(range.missingEpisodes, [6, 5]);
  assert.equal(range.slots[1].status, "unavailable");
  assert.equal(range.slots[1].failure, "database");
  assert.equal(range.slots[2].status, "not-collected");
  assert.ok(!JSON.stringify(range).includes("private connection"));
  const empty = reader({ loadSnapshot: async () => null });
  assert.equal((await empty.readRange(7)).status, "not-collected");
  assert.equal((await empty.readRange()).status, "latest-unknown");
  const failed = reader({
    loadSnapshot: async () => {
      throw Error("offline");
    },
  });
  assert.equal((await failed.readRange(7)).status, "unavailable");
  assert.equal((await failed.readDraw(600)).status, "unavailable");
});

test("DB 동시 조회는 최대3개이며 같은 대상과 의존 회차는 요청을 공유한다", async () => {
  let active = 0,
    max = 0;
  const calls: number[] = [];
  const r = reader({
    loadSnapshot: async (n) => {
      calls.push(n!);
      active++;
      max = Math.max(max, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return load(n);
    },
  });
  const [target, history, other] = await Promise.all([
    r.readDraw(100),
    r.readPrevious(101),
    r.readPrevious(100),
  ]);
  assert.equal(target.draw?.episode, 100);
  assert.equal(history.slots.length, 5);
  assert.equal(other.slots.length, 5);
  assert.equal(calls.length, 6);
  assert.ok(max <= 3);
});

test("최신 포인터가 실패해도 과거 단건과 이전 회차의 실패는 독립 처리한다", async () => {
  const r = reader({
    loadSnapshot: async (n) => {
      if (n === undefined || n === 99) throw Error("offline");
      return load(n);
    },
  });
  assert.equal((await r.readDraw(100)).status, "fresh");
  assert.equal((await r.readLatest()).status, "unavailable");
  const history = await r.readPrevious(100);
  assert.equal(history.status, "partial");
  assert.deepEqual(history.missingEpisodes, [99]);
  assert.deepEqual(
    history.slots.map((s) => s.episode),
    [99, 98, 97, 96, 95],
  );
});

test("캐시 갱신 주기와 원천 확인시각은 분리하고 장애에도 정상 스냅샷을 보존한다", async () => {
  const entries = new Map<string, DrawSnapshot>();
  const ttls = new Map<string, number>();
  let fail = false;
  const cache: DrawCache = async (key, ttl, load) => {
    ttls.set(key, ttl);
    try {
      const value = await load();
      entries.set(key, value);
      return value;
    } catch (error) {
      const old = entries.get(key);
      if (old) return old;
      throw error;
    }
  };
  const r = reader({
    cache,
    isFresh: (_snapshot, n) => n !== undefined || !fail,
    loadSnapshot: async (n) => {
      if (fail) throw Error("offline");
      return load(n);
    },
  });
  const first = await r.readLatest();
  await r.readDraw(600);
  fail = true;
  const retained = await r.readLatest();
  assert.equal(retained.status, "stale");
  assert.equal(retained.checkedAt, first.checkedAt);
  assert.equal((await r.readDraw(600)).status, "fresh");
  assert.equal(ttls.get("latest"), 300);
  assert.equal(ttls.get("600"), 86400);
  const past = await r.readRange();
  assert.equal(past.to, 1247);
});

test("미수집·실패는 캐시에 쓰지 않고 독립 재시도에서 복구한다", async () => {
  let attempts = 0,
    writes = 0;
  const r = reader({
    loadSnapshot: async () => (++attempts === 1 ? null : snapshot(600)),
    cache: async (_key, _ttl, load) => {
      const value = await load();
      writes++;
      return value;
    },
  });
  assert.equal((await r.readDraw(600)).status, "not-collected");
  assert.equal(writes, 0);
  assert.equal((await r.readDraw(600)).draw?.episode, 600);
  assert.equal(writes, 1);
});

test("개별 취소는 공유 DB 조회를 중단하지 않고 취소된 구간은 추가 슬롯을 읽지 않는다", async () => {
  let calls = 0;
  const r = reader({
    loadSnapshot: async (n) => {
      calls++;
      if (n !== undefined)
        await new Promise((resolve) => setTimeout(resolve, 10));
      return load(n);
    },
  });
  const controller = new AbortController();
  const old = r.readDraw(100, { signal: controller.signal });
  const shared = r.readDraw(100);
  controller.abort();
  assert.equal((await old).status, "cancelled");
  assert.equal((await shared).draw?.episode, 100);
  calls = 0;
  const rangeController = new AbortController();
  const range = r.readRange(undefined, { signal: rangeController.signal });
  await new Promise((resolve) => setTimeout(resolve, 2));
  rangeController.abort();
  assert.equal((await range).status, "cancelled");
  assert.ok(calls <= 4);
});

test("캐시가 즉시 반환해도 같은 회차의 백그라운드 DB 조회를 공유한다", async () => {
  let calls = 0;
  const background: Promise<unknown>[] = [];
  const r = reader({
    cache: async (_key, _ttl, load) => {
      background.push(load().catch(() => null));
      return snapshot(600);
    },
    loadSnapshot: async (n) => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return load(n);
    },
  });
  await r.readDraw(600);
  await r.readDraw(600);
  await Promise.all(background);
  assert.equal(calls, 1);
});
