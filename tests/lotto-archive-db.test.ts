import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { createArchiveReader } from "../src/lib/lotto-archive/store";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const draw = {
  episode: 1247,
  drawDate: "2026-10-24",
  numbers: [8, 14, 21, 22, 42, 45],
  bonus: 24,
};

test("격리 PostgreSQL: 제약·역할·fencing·멱등 정정·일일 할당량 제거", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      await readFile(
        new URL("../migrations/001_lotto_archive.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../migrations/002_regular_sync.sql", import.meta.url),
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
    await db.exec(`RESET ROLE;
      INSERT INTO lotto.sync_budget_daily(day,source_requests,run_attempts) VALUES ((now() AT TIME ZONE 'Asia/Seoul')::date,100,40);
      UPDATE lotto.sync_state SET usage_percent=100,usage_checked_at=now(),last_source_at=now()-interval '2 seconds';
      SET ROLE lotto_writer;`);
    await db.query("SELECT lotto.sync_action($1::uuid,2,'reserve','{}')", [
      other,
    ]);
    await db.query(
      `SELECT lotto.sync_action($1::uuid,2,'finish','{"status":"success"}')`,
      [other],
    );
    assert.ok(
      (
        await db.query<{ result: unknown }>(
          "SELECT lotto.acquire_sync($1::uuid,'daily') AS result",
          ["00000000-0000-4000-8000-000000000003"],
        )
      ).rows[0].result,
    );
    await db.exec("RESET ROLE; SET ROLE lotto_reader");
    const reader = createArchiveReader(
      async (sql, params) =>
        (await db.query<Record<string, unknown>>(sql, params)).rows,
    );
    const snapshot = await reader.readRecord(1247);
    assert.equal(snapshot?.draw.bonus, 25);
    assert.equal(
      snapshot?.sourceUrl,
      "https://www.dhlottery.co.kr/lt645/result",
    );
    assert.ok(snapshot?.checkedAt.endsWith("Z"));
    assert.equal((await reader.readLatest()).round, 1247);
    assert.equal(await reader.readRecord(600), null);
    await db.exec("RESET ROLE; SET ROLE lotto_writer");
    assert.deepEqual(
      (
        await db.query(
          "SELECT source_requests,run_attempts FROM lotto.sync_budget_daily",
        )
      ).rows,
      [{ source_requests: 100, run_attempts: 40 }],
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

test("DB 예약은 일일 카운터 없이 실행 사이의 1초 간격을 유지한다", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      await readFile(
        new URL("../migrations/001_lotto_archive.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../migrations/002_regular_sync.sql", import.meta.url),
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
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM lotto.sync_budget_daily",
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("마이그레이션 파일을 버전순으로 읽고 001→002 적용·재실행 시 기존 데이터를 보존한다", async () => {
  const { loadArchiveMigrations, migrationStatement } =
    await import("../scripts/archive-migration");
  const migrations = await loadArchiveMigrations();
  assert.deepEqual(
    migrations.map((m) => m.version),
    ["001", "002"],
  );
  const db = new PGlite();
  try {
    await db.query(
      migrationStatement(migrations[0].version, migrations[0].body),
    );
    await db.exec(`
      INSERT INTO lotto.draws(round,draw_date,number_1,number_2,number_3,number_4,number_5,number_6,bonus,source_url,verified_at,content_hash)
      VALUES(1247,'2026-10-24',8,14,21,22,42,45,24,'https://www.dhlottery.co.kr/lt645/result',now(),repeat('a',64));
      INSERT INTO lotto.sync_failures(round,attempts,next_retry_at,error_code) VALUES(600,2,now(),'network');
      INSERT INTO lotto.sync_budget_daily(day,source_requests,run_attempts) VALUES(current_date,100,40);
      UPDATE lotto.sync_state SET usage_percent=99,usage_checked_at=now(),backfill_next_round=1;
    `);
    const before = (await db.query("SELECT * FROM lotto.draws")).rows;
    for (const migration of migrations)
      await db.query(migrationStatement(migration.version, migration.body));
    assert.deepEqual(
      (await db.query("SELECT * FROM lotto.draws")).rows,
      before,
    );
    assert.equal(
      (
        await db.query<{ regular_from_round: number }>(
          "SELECT regular_from_round FROM lotto.sync_state",
        )
      ).rows[0].regular_from_round,
      1248,
    );
    assert.equal(
      (
        await db.query<{ attempts: number }>(
          "SELECT attempts FROM lotto.sync_failures",
        )
      ).rows[0].attempts,
      2,
    );
    // 재적용 시에도 경계와 기존 관리 기록을 보존한다.
    await db.query(
      migrationStatement(migrations[1].version, migrations[1].body),
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM lotto_migrations.versions",
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query<{ regular_from_round: number }>(
          "SELECT regular_from_round FROM lotto.sync_state",
        )
      ).rows[0].regular_from_round,
      1248,
    );
    await assert.rejects(
      db.query(migrationStatement("002", migrations[1].body + "\n-- changed")),
      /checksum/,
    );
  } finally {
    await db.close();
  }
});
