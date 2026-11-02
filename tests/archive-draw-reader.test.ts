import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { createArchiveDrawReader } from "../src/lib/archive-draw-reader";
import { createArchiveReader } from "../src/lib/lotto-archive/store";
import { draw } from "./lotto-fixtures";

function database(missing: number[] = []) {
  return createArchiveReader(async (sql, params) => {
    assert.match(sql, /^SELECT /);
    assert.doesNotMatch(sql, /sync_action|sync_state|INSERT|UPDATE/);
    if (sql.includes("lotto.latest"))
      return [
        {
          latest_confirmed_round: 1247,
          latest_checked_at: "2026-10-24T13:00:00Z",
        },
      ];
    const n = Number(params?.[0]);
    if (missing.includes(n)) return [];
    const d = draw(n);
    return [
      {
        round: n,
        draw_date: d.drawDate,
        ...Object.fromEntries(d.numbers.map((v, i) => [`number_${i + 1}`, v])),
        bonus: d.bonus,
        source_url: "https://www.dhlottery.co.kr/lt645/result",
        verified_at: "2026-10-24T13:00:00Z",
      },
    ];
  });
}

test("공개 최근5회·고정20개 슬롯·상세는 DB만 읽고 미수집을 구분한다", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => {
    throw Error("public must not call source");
  });
  try {
    const reader = createArchiveDrawReader({
      database: async () => database([1245]),
      now: () => Date.parse("2026-10-28T00:00:00Z"),
    });
    assert.equal((await reader.readLatest()).status, "fresh");
    assert.equal((await reader.readDraw(1246)).status, "fresh");
    const recent = await reader.readRecent();
    assert.equal(recent.status, "partial");
    assert.equal(recent.checkedAt, "2026-10-24T13:00:00.000Z");
    assert.deepEqual(recent.missingEpisodes, [1245]);
    assert.equal(recent.validUntil, "2026-10-31T11:35:00.000Z");
    const list = await reader.readRange(1247);
    assert.equal(list.slots.length, 20);
    assert.equal(list.slots[2].status, "not-collected");
    assert.equal(list.slots[2].episode, 1245);
    assert.equal((await reader.readDraw(1246)).draw?.episode, 1246);
    assert.equal(fetch.mock.callCount(), 0);
  } finally {
    fetch.mock.restore();
  }
});

test("DB 장애에 원천 fallback하지 않고 추첨 후에도 과거 기록을 유지한다", async () => {
  const broken = createArchiveDrawReader({
    database: async () => {
      throw Error("private-url");
    },
  });
  assert.equal((await broken.readDraw(1247)).status, "unavailable");
  const failed = await broken.readRecent();
  assert.equal(failed.status, "unavailable");
  assert.ok(!JSON.stringify(failed).includes("private-url"));
  const reader = createArchiveDrawReader({
    database: async () => database([1245]),
    now: () => Date.parse("2026-10-31T12:00:00Z"),
  });
  assert.equal((await reader.readRecent()).status, "stale");
  const range = await reader.readRange();
  assert.equal(range.to, 1247);
  assert.equal(range.slots.length, 20);
  const previous = await reader.readPrevious(1247);
  assert.equal(previous.slots[1].status, "not-collected");
  assert.equal((await reader.readDraw(1247)).draw?.episode, 1247);
});

test("정상 DB 캐시는 장애에도 원천 확인시각을 유지하고 갱신 뒤 추가 적재를 반영한다", async () => {
  const cache = new Map<
    string,
    import("../src/lib/draw-reader").DrawSnapshot
  >();
  let missing = [1245];
  let offline = false;
  const reader = createArchiveDrawReader({
    database: async () => {
      if (offline) throw Error("offline");
      return database(missing);
    },
    now: () => Date.parse("2026-10-28T00:00:00Z"),
    cache: async (key, _ttl, load) => {
      try {
        const snapshot = await load();
        cache.set(key, snapshot);
        return snapshot;
      } catch (error) {
        const old = cache.get(key);
        if (old) return old;
        throw error;
      }
    },
  });
  const first = await reader.readRecent();
  assert.deepEqual(first.missingEpisodes, [1245]);
  offline = true;
  const retained = await reader.readRecent();
  assert.equal(retained.checkedAt, first.checkedAt);
  assert.equal(retained.draws.length, first.draws.length);
  offline = false;
  missing = [];
  const added = await reader.readRecent();
  assert.equal(added.status, "fresh");
  assert.deepEqual(added.missingEpisodes, []);
  assert.equal(added.checkedAt, first.checkedAt);
});

test("공식 최신이 미수집인 정상 빈 DB는 장애와 다른 상태를 반환한다", async () => {
  const reader = createArchiveDrawReader({
    database: async () =>
      createArchiveReader(async () => [
        { latest_confirmed_round: null, latest_checked_at: null },
      ]),
  });
  const data = await reader.readRecent();
  assert.equal(data.status, "not-collected");
  assert.equal(data.latestEpisode, null);
  assert.deepEqual(data.draws, []);
  assert.equal(data.checkedAt, null);
});
