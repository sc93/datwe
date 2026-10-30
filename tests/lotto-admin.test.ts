import assert from "node:assert/strict";
import test from "node:test";

import {
  checkDatabaseTarget,
  handleSyncRequest,
} from "../src/lib/lotto-archive/admin";

const env = {
  VERCEL_ENV: "production",
  LOTTO_ARCHIVE_ENABLED: "true",
  CRON_SECRET: "a".repeat(40),
  DATABASE_WRITE_URL:
    "postgresql://runtime:password@ep-test.example/db?sslmode=require",
  DATABASE_PRODUCTION_HOST: "ep-test.example",
};
test("관리 인증·환경 차단 시 원천·DB 쓰기 0회", async () => {
  let runs = 0;
  const run = async () => {
    runs++;
    return { status: "success" };
  };
  for (const [config, auth, status] of [
    [env, null, 401],
    [env, "Bearer wrong", 401],
    [{ ...env, VERCEL_ENV: "preview" }, `Bearer ${env.CRON_SECRET}`, 403],
    [
      { ...env, LOTTO_ARCHIVE_ENABLED: undefined },
      `Bearer ${env.CRON_SECRET}`,
      403,
    ],
    [
      { ...env, DATABASE_PRODUCTION_HOST: "ep-other.example" },
      `Bearer ${env.CRON_SECRET}`,
      503,
    ],
    [{ ...env, CRON_SECRET: undefined }, null, 503],
  ] as const) {
    const res = await handleSyncRequest(
      new Request("https://example.com/api/admin/lotto/sync", {
        headers: auth ? { authorization: auth } : {},
      }),
      "daily",
      config,
      run,
    );
    assert.equal(res.status, status);
    assert.equal(runs, 0);
  }
  const success = await handleSyncRequest(
    new Request("https://example.com/api/admin/lotto/sync", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    }),
    "daily",
    env,
    run,
  );
  assert.equal(success.status, 200);
  assert.equal(runs, 1);
});

test("수동 요청은 정수 최대2회차만 허용하고 원문 오류를 노출하지 않는다", async () => {
  let rounds: number[] | undefined;
  const res = await handleSyncRequest(
    new Request("https://example.com", {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      body: JSON.stringify({ rounds: [1, 600] }),
    }),
    "manual",
    env,
    async (input) => {
      rounds = input.rounds;
      return { status: "success" };
    },
  );
  assert.equal(res.status, 200);
  assert.deepEqual(rounds, [1, 600]);
  for (const data of [
    { rounds: [0] },
    { rounds: [1, 2, 3] },
    { rounds: ["1"] },
    { rounds: [2 ** 40] },
    { extra: "value" },
  ]) {
    const invalid = await handleSyncRequest(
      new Request("https://example.com", {
        method: "POST",
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
        body: JSON.stringify(data),
      }),
      "manual",
      env,
      async () => {
        throw Error("must not run");
      },
    );
    assert.equal(invalid.status, 400);
  }
  const failed = await handleSyncRequest(
    new Request("https://example.com", {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    }),
    "daily",
    env,
    async () => {
      throw Error("postgresql://secret");
    },
  );
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes("secret"));
});

test("격리 DB 대상 확인은 운영 호스트·혼합 자격·소유자 자격을 거부한다", () => {
  const config = { ...env, DATABASE_ISOLATED_HOST: "ep-isolated.example" };
  assert.throws(() =>
    checkDatabaseTarget(env.DATABASE_WRITE_URL, "isolated", config),
  );
  assert.throws(() =>
    checkDatabaseTarget(
      "postgresql://neondb_owner:secret@ep-isolated.example/db",
      "isolated",
      config,
    ),
  );
  assert.equal(
    checkDatabaseTarget(
      "postgresql://writer:secret@ep-isolated.example/db?sslmode=require",
      "isolated",
      config,
    ),
    "ep-isolated.example",
  );
});
