import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const draw = {
  episode: 1247,
  drawDate: "2026-10-24",
  numbers: [8, 14, 21, 22, 42, 45],
  bonus: 24,
};

test("격리 PostgreSQL: 제약·역할·fencing·멱등 정정·예산·보존", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      await readFile(
        new URL("../migrations/001_lotto_archive.sql", import.meta.url),
        "utf8",
      ),
    );
    const baseline = await db.query(
      `SELECT relname, pg_table_size(c.oid) AS table_bytes, pg_indexes_size(c.oid) AS index_bytes FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='lotto' AND relkind='r' ORDER BY relname`,
    );
    console.log(
      "격리 PGlite 생성 직후 baseline:",
      JSON.stringify(baseline.rows),
    );
    await db.exec("SET ROLE lotto_reader");
    await db.query<Record<string, unknown>>("SELECT * FROM lotto.draws");
    await db.query<Record<string, unknown>>("SELECT * FROM lotto.latest");
    await assert.rejects(
      db.query<Record<string, unknown>>("SELECT * FROM lotto.sync_state"),
      /permission denied/,
    );
    await assert.rejects(
      db.query<Record<string, unknown>>("DELETE FROM lotto.draws"),
      /permission denied/,
    );
    await assert.rejects(
      db.query<Record<string, unknown>>("CREATE TABLE lotto.forbidden(id int)"),
      /permission denied/,
    );
    await db.exec("RESET ROLE; SET ROLE lotto_writer");
    await assert.rejects(
      db.query<Record<string, unknown>>("CREATE TABLE lotto.forbidden(id int)"),
      /permission denied/,
    );
    await db.exec("RESET ROLE");
    for (const numbers of [
      [8, 8, 21, 22, 42, 45],
      [0, 14, 21, 22, 42, 45],
      [8, 14, 21, 22, 42, 46],
    ]) {
      await assert.rejects(
        db.query(
          `INSERT INTO lotto.draws(round,draw_date,number_1,number_2,number_3,number_4,number_5,number_6,bonus,source_url,verified_at,content_hash) VALUES (1,'2002-12-07',$1,$2,$3,$4,$5,$6,24,'https://www.dhlottery.co.kr/lt645/result',now(),repeat('a',64))`,
          numbers,
        ),
        /check constraint/,
      );
    }
    await db.exec("SET ROLE lotto_writer");
    const call = async (action: string, data: unknown = {}, token = 1) =>
      (
        await db.query<{ result: unknown }>(
          "SELECT lotto.sync_action($1::uuid,$2::bigint,$3,$4::jsonb) AS result",
          [owner, token, action, JSON.stringify(data)],
        )
      ).rows[0].result;
    const acquired = (
      await db.query<{ result: { token: number } }>(
        "SELECT lotto.acquire_sync($1::uuid,'daily') AS result",
        [owner],
      )
    ).rows[0].result;
    assert.equal(acquired.token, 1);
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT lotto.acquire_sync($1::uuid,'daily') AS result",
          [other],
        )
      ).rows[0].result,
      null,
    );
    await call("reserve");
    await call("save", {
      draw,
      sourceUrl: "https://www.dhlottery.co.kr/lt645/result",
      verifiedAt: new Date().toISOString(),
      hash: "a".repeat(64),
      latest: true,
    });
    await call("save", {
      draw,
      sourceUrl: "https://www.dhlottery.co.kr/lt645/result",
      verifiedAt: new Date().toISOString(),
      hash: "a".repeat(64),
      latest: true,
    });
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT count(*)::int n FROM lotto.draws",
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      call("save", {
        draw: { ...draw, bonus: 8 },
        sourceUrl: "https://www.dhlottery.co.kr/lt645/result",
        verifiedAt: new Date().toISOString(),
        hash: "b".repeat(64),
        latest: true,
      }),
      /check constraint/,
    );
    assert.equal(
      (await db.query<Record<string, unknown>>("SELECT bonus FROM lotto.draws"))
        .rows[0].bonus,
      24,
    );
    await call("save", {
      draw: { ...draw, bonus: 25 },
      sourceUrl: "https://www.dhlottery.co.kr/lt645/result",
      verifiedAt: new Date().toISOString(),
      hash: "b".repeat(64),
      latest: true,
    });
    assert.equal(
      (await db.query<Record<string, unknown>>("SELECT bonus FROM lotto.draws"))
        .rows[0].bonus,
      25,
    );
    await assert.rejects(
      call("save", {
        draw: { ...draw, episode: 1246 },
        sourceUrl: "https://www.dhlottery.co.kr/lt645/result",
        verifiedAt: new Date().toISOString(),
        hash: "c".repeat(64),
        latest: true,
      }),
      /latest-regression/,
    );
    await call("failure", { round: 2, code: "timeout" });
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT attempts FROM lotto.sync_failures WHERE round=2",
        )
      ).rows[0].attempts,
      1,
    );
    await db.exec(
      "RESET ROLE; UPDATE lotto.sync_state SET lease_until=now()-interval '1 second'",
    );
    await assert.rejects(call("save", {}), /lease-lost/);
    await db.exec("SET ROLE lotto_writer");
    const recovered = (
      await db.query<{ result: { token: number } }>(
        "SELECT lotto.acquire_sync($1::uuid,'manual') AS result",
        [other],
      )
    ).rows[0].result;
    assert.equal(recovered.token, 2);
    await assert.rejects(call("reserve"), /lease-lost/);
    await db.exec(
      "RESET ROLE; UPDATE lotto.sync_budget_daily SET source_requests=100",
    );
    await assert.rejects(
      db.query<Record<string, unknown>>(
        "SELECT lotto.sync_action($1::uuid,2,'reserve','{}')",
        [other],
      ),
      /request-budget/,
    );
    await db.exec(
      "UPDATE lotto.sync_budget_daily SET run_attempts=40; UPDATE lotto.sync_state SET lease_until=now()-interval '1 second'",
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT lotto.acquire_sync($1::uuid,'daily') AS result",
          [owner],
        )
      ).rows[0].result,
      null,
    );
  } finally {
    await db.close();
  }
});

test("마이그레이션: 재실행·checksum·DDL 롤백을 보호한다", async () => {
  const { migrationStatement } = await import("../scripts/archive-migration");
  const db = new PGlite();
  try {
    const body = await readFile(
      new URL("../migrations/001_lotto_archive.sql", import.meta.url),
      "utf8",
    );
    await db.query(migrationStatement("001", body));
    await db.query(migrationStatement("001", body));
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT count(*)::int n FROM lotto_migrations.versions",
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      db.query(migrationStatement("001", body + "\n-- changed")),
      /checksum/,
    );
    await assert.rejects(
      db.query(
        migrationStatement(
          "002",
          "CREATE TABLE lotto.rollback_test(id int); SELECT missing_function();",
        ),
      ),
      /missing_function/,
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "SELECT to_regclass('lotto.rollback_test') AS name",
        )
      ).rows[0].name,
      null,
    );
  } finally {
    await db.close();
  }
});

test("DB 일일 예약은 실행 사이의 1초 간격과 KST 일 경계를 유지한다", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      await readFile(
        new URL("../migrations/001_lotto_archive.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.query("SELECT lotto.acquire_sync($1::uuid,'daily')", [owner]);
    await db.query("SELECT lotto.sync_action($1::uuid,1,'reserve','{}')", [
      owner,
    ]);
    await assert.rejects(
      db.query("SELECT lotto.sync_action($1::uuid,1,'reserve','{}')", [owner]),
      /request-budget/,
    );
    const [row] = (
      await db.query<Record<string, unknown>>(
        "SELECT day=(clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date AS kst,source_requests FROM lotto.sync_budget_daily",
      )
    ).rows;
    assert.equal(row.kst, true);
    assert.equal(row.source_requests, 1);
  } finally {
    await db.close();
  }
});
