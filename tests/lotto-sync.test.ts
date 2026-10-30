import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import {
  canonicalDraw,
  createOfficialSource,
} from "../src/lib/lotto-archive/source";
import { createArchiveStore } from "../src/lib/lotto-archive/store";
import { runSync } from "../src/lib/lotto-sync";

const latest = {
  episode: 1247,
  drawDate: "2026-10-24",
  numbers: [8, 14, 21, 22, 42, 45],
  bonus: 24,
};
async function fixture() {
  const db = new PGlite();
  await db.exec(
    await readFile(
      new URL("../migrations/001_lotto_archive.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    "UPDATE lotto.sync_state SET usage_percent=20,usage_checked_at=now(); SET ROLE lotto_writer",
  );
  const store = createArchiveStore(
    async (sql, params) =>
      (await db.query<Record<string, unknown>>(sql, params)).rows,
  );
  return { db, store };
}

test("canonical hash는 입력을 변경하지 않고 정렬·날짜·보너스를 검증한다", () => {
  assert.deepEqual(
    canonicalDraw({ ...latest, numbers: [45, 42, 22, 21, 14, 8] }),
    latest,
  );
  for (const bad of [
    { ...latest, bonus: 8 },
    { ...latest, drawDate: "2026-02-30" },
    { ...latest, numbers: [1, 1, 2, 3, 4, 5] },
    { ...latest, episode: 2 ** 40 },
  ])
    assert.throws(() => canonicalDraw(bad));
});

test("수집: 최신 재사용·최대3요청·1초 간격·멱등 저장·공식 포인터 분리", async () => {
  const { db, store } = await fixture();
  let clock = Date.parse("2026-10-30T00:00:00Z");
  const starts: number[] = [];
  const invalidated: number[] = [];
  try {
    const result = await runSync({
      store,
      now: () => clock,
      sleep: async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        clock += ms;
      },
      source: async (round) => {
        starts.push(clock);
        return {
          draw:
            round === undefined
              ? latest
              : { ...latest, episode: round, drawDate: "2002-12-07" },
          sourceUrl: "https://www.dhlottery.co.kr/lt645/result",
          verifiedAt: new Date().toISOString(),
        };
      },
      invalidate: async (round) => {
        invalidated.push(round);
      },
    });
    assert.equal(result.requests, 3);
    assert.equal(result.succeeded, 3);
    assert.deepEqual(
      starts.map((x) => x - starts[0]),
      [0, 1000, 2000],
    );
    assert.deepEqual(invalidated, [1247, 1, 2]);
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT latest_confirmed_round FROM lotto.sync_state",
        )
      ).rows[0].latest_confirmed_round,
      1247,
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT count(*)::int n FROM lotto.draws",
        )
      ).rows[0].n,
      3,
    );
  } finally {
    await db.close();
  }
});

test("403 차단은 즉시 중단하고 Retry-After·실패 큐를 보존한다", async () => {
  const { db, store } = await fixture();
  let calls = 0;
  try {
    const result = await runSync({
      store,
      source: createOfficialSource(async () => {
        calls++;
        return new Response("", {
          status: 429,
          headers: { "Retry-After": "172800" },
        });
      }),
      invalidate: async () => {
        throw Error("must not invalidate");
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.status, "failed");
    assert.equal(result.code, "blocked");
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT count(*)::int n FROM lotto.draws",
        )
      ).rows[0].n,
      0,
    );
    assert.ok(
      new Date(
        (
          await db.query<Record<string, unknown>>(
            "SELECT next_source_at FROM lotto.sync_state",
          )
        ).rows[0].next_source_at as string,
      ).getTime() >
        Date.now() + 47 * 3600000,
    );
    const skipped = await runSync({
      store,
      source: async () => {
        throw Error("must not fetch");
      },
      invalidate: async () => {},
    });
    assert.equal(skipped.status, "skipped");
  } finally {
    await db.close();
  }
});

test("부분 실패는 정상 회차를 보존하고 캐시 실패는 outbox에서 재처리한다", async () => {
  const { db, store } = await fixture();
  let clock = Date.parse("2026-10-30T00:00:00Z");
  try {
    const result = await runSync({
      store,
      now: () => clock,
      sleep: async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        clock += ms;
      },
      source: async (round) => {
        if (round === 1) throw Error("network raw secret must not escape");
        return {
          draw: round === undefined ? latest : { ...latest, episode: round },
          sourceUrl: "https://www.dhlottery.co.kr/lt645/result",
          verifiedAt: new Date().toISOString(),
        };
      },
      invalidate: async () => {
        throw Error("cache");
      },
    });
    assert.equal(result.status, "partial");
    assert.equal(result.failed, 1);
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT attempts FROM lotto.sync_failures WHERE round=1",
        )
      ).rows[0].attempts,
      1,
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT count(*)::int n FROM lotto.sync_cache_pending",
        )
      ).rows[0].n,
      2,
    );
    assert.ok(!JSON.stringify(result).includes("secret"));
    await runSync({
      store,
      now: () => clock,
      sleep: async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        clock += ms;
      },
      source: async () => {
        throw Error("offline");
      },
      invalidate: async () => {},
    });
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT count(*)::int n FROM lotto.sync_cache_pending",
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("사용량 95%에서 원천0회, 85% 또는 미확인에서 과거 누락 수집 중지", async () => {
  for (const usage of [95, 85, null]) {
    const { db, store } = await fixture();
    let clock = Date.parse("2026-10-30T00:00:00Z");
    const requested: (number | undefined)[] = [];
    try {
      await db.exec(
        `RESET ROLE; UPDATE lotto.sync_state SET usage_percent=${usage ?? "NULL"}; SET ROLE lotto_writer`,
      );
      const result = await runSync({
        store,
        now: () => clock,
        sleep: async (ms) => {
          await new Promise((resolve) => setTimeout(resolve, ms));
          clock += ms;
        },
        source: async (round) => {
          requested.push(round);
          return {
            draw: latest,
            sourceUrl: "https://www.dhlottery.co.kr/lt645/result",
            verifiedAt: new Date().toISOString(),
          };
        },
        invalidate: async () => {},
      });
      assert.equal(requested.length, usage === 95 ? 0 : 1);
      assert.ok(result.warnings.length > 0);
    } finally {
      await db.close();
    }
  }
});

test("본문이 멈춘 원천은 타임아웃으로 종료하고 HTML/잘못된 응답을 저장하지 않는다", async () => {
  const source = createOfficialSource(
    async () => new Response(new ReadableStream({ start() {} })),
    { timeoutMs: 15 },
  );
  await assert.rejects(source(undefined), /timeout/);
  await assert.rejects(
    createOfficialSource(
      async () =>
        new Response("<html>blocked</html>", {
          headers: { "content-type": "text/html" },
        }),
    )(undefined),
    /blocked/,
  );
});

test("최신 일정 불일치·회차 후퇴는 정상 포인터와 캐시를 보존한다", async () => {
  const { db, store } = await fixture();
  try {
    const result = await runSync({
      store,
      source: async () => ({
        draw: { ...latest, episode: 2000 },
        sourceUrl: "https://www.dhlottery.co.kr/lt645/result",
        verifiedAt: new Date().toISOString(),
      }),
      invalidate: async () => {
        throw Error("must not invalidate");
      },
    });
    assert.equal(result.code, "schedule");
    assert.equal(result.succeeded, 0);
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT latest_confirmed_round FROM lotto.sync_state",
        )
      ).rows[0].latest_confirmed_round,
      null,
    );
  } finally {
    await db.close();
  }
});

test("20초 실행 예산이 부족하면 요청을 시작하지 않고 커서를 보존한다", async () => {
  const { db, store } = await fixture();
  const clock = Date.now();
  try {
    const result = await runSync({
      store,
      now: () => clock,
      deadlineAt: clock + 5999,
      source: async () => {
        throw Error("must not fetch");
      },
      invalidate: async () => {},
    });
    assert.equal(result.requests, 0);
    assert.equal(result.code, "deadline");
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT backfill_next_round FROM lotto.sync_state",
        )
      ).rows[0].backfill_next_round,
      1,
    );
  } finally {
    await db.close();
  }
});

test("미해결 실패·30일/90일 보존과 1→2→4→7일 백오프", async () => {
  const { db, store } = await fixture();
  try {
    let lease = await store.acquire(
      "00000000-0000-4000-8000-000000000010",
      "daily",
    );
    assert.ok(lease);
    for (const days of [1, 2, 4, 7, 7]) {
      await store.failure(lease, 600, "network");
      const [f] = (
        await db.query<Record<string, unknown>>(
          "SELECT extract(epoch FROM (next_retry_at-clock_timestamp()))/86400 AS days FROM lotto.sync_failures WHERE round=600",
        )
      ).rows;
      assert.ok(Math.abs(Number(f.days) - days) < 0.01);
    }
    await store.finish(lease, "failed", "network");
    await db.exec(
      "RESET ROLE; UPDATE lotto.sync_runs SET finished_at=now()-interval '31 days'; INSERT INTO lotto.sync_budget_daily(day) VALUES ((now() AT TIME ZONE 'Asia/Seoul')::date-91); UPDATE lotto.sync_failures SET updated_at=now()-interval '120 days'; SET ROLE lotto_writer",
    );
    lease = await store.acquire(
      "00000000-0000-4000-8000-000000000011",
      "daily",
    );
    assert.ok(lease);
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT count(*)::int n FROM lotto.sync_runs",
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT count(*)::int n FROM lotto.sync_budget_daily",
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT count(*)::int n FROM lotto.sync_failures",
        )
      ).rows[0].n,
      1,
    );
    assert.equal((await store.reserve(lease, 600)).allowed, false);
  } finally {
    await db.close();
  }
});

test("Retry-After가 내부 백오프보다 길면 공급자 대기시간을 줄이지 않는다", async () => {
  const now = Date.parse("2026-10-30T00:00:00Z");
  const source = createOfficialSource(
    async () =>
      new Response("", { status: 429, headers: { "Retry-After": "7776000" } }),
    { now: () => now },
  );
  await assert.rejects(
    source(),
    (error: unknown) =>
      error instanceof Error &&
      "retryAt" in error &&
      error.retryAt === "2027-01-28T00:00:00.000Z",
  );
});

test("개별 회차 실행 마감은 deadline 코드와 재시도 시각으로 저장한다", async () => {
  const { db, store } = await fixture();
  try {
    const lease = await store.acquire(
      "00000000-0000-4000-8000-000000000012",
      "manual",
    );
    assert.ok(lease);
    await store.failure(lease, 600, "deadline");
    const [row] = (
      await db.query<Record<string, unknown>>(
        "SELECT error_code,attempts,next_retry_at>now() AS delayed FROM lotto.sync_failures WHERE round=600",
      )
    ).rows;
    assert.equal(row.error_code, "deadline");
    assert.equal(row.attempts, 1);
    assert.equal(row.delayed, true);
  } finally {
    await db.close();
  }
});

test(
  "요청 시작 직후 상위 취소도 놓치지 않고 마감 실패로 종료한다",
  { timeout: 7000 },
  async () => {
    const { db, store } = await fixture();
    const controller = new AbortController();
    try {
      const result = await runSync({
        store,
        signal: controller.signal,
        source: async () => {
          controller.abort();
          return new Promise(() => {});
        },
        invalidate: async () => {},
      });
      assert.equal(result.code, "deadline");
      assert.equal(result.status, "failed");
    } finally {
      await db.close();
    }
  },
);

test("전체 적재 후에는 최신 확인만 하고 저장된 과거 회차의 실패 기록도 자동 재조회하지 않는다", async () => {
  const { db, store } = await fixture();
  const requested: (number | undefined)[] = [];
  try {
    await db.exec(`RESET ROLE;
 INSERT INTO lotto.draws(round,draw_date,number_1,number_2,number_3,number_4,number_5,number_6,bonus,source_url,verified_at,content_hash)
 SELECT g,DATE '2002-12-07'+(g-1)*7,8,14,21,22,42,45,24,'https://www.dhlottery.co.kr/lt645/result',now(),repeat('a',64) FROM generate_series(1,1247) g;
 INSERT INTO lotto.sync_failures(round,attempts,next_retry_at,error_code) VALUES(600,1,now()-interval '1 day','network');
 SET ROLE lotto_writer;`);
    const result = await runSync({
      store,
      now: () => Date.parse("2026-10-30T00:00:00Z"),
      source: async (round) => {
        requested.push(round);
        return {
          draw: { ...latest, episode: round ?? 1247 },
          sourceUrl: "https://www.dhlottery.co.kr/lt645/result",
          verifiedAt: new Date().toISOString(),
        };
      },
      invalidate: async () => {},
    });
    assert.deepEqual(requested, [undefined]);
    assert.equal(result.requests, 1);
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT count(*)::int n FROM lotto.draws",
        )
      ).rows[0].n,
      1247,
    );
  } finally {
    await db.close();
  }
});
