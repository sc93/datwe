import { readFile } from "node:fs/promises";

import { neon } from "@neondatabase/serverless";

import { checkDatabaseTarget } from "../src/lib/lotto-archive/admin";
import { migrationStatement } from "./archive-migration";

async function main() {
  const raw = process.env.DATABASE_MIGRATION_URL;
  checkDatabaseTarget(raw, "isolated", process.env, true);
  const sql = neon(raw!, {
    fetchOptions: { signal: AbortSignal.timeout(20000) },
  });
  const body = await readFile(
    new URL("../migrations/001_lotto_archive.sql", import.meta.url),
    "utf8",
  );
  if (process.argv.includes("--apply")) {
    await sql.transaction([
      sql.query("SELECT set_config('statement_timeout','10000',true)"),
      sql.query(migrationStatement("001", body)),
    ]);
    console.log("격리 DB 마이그레이션 확인 완료: 001");
  } else {
    console.log(
      "dry-run: 대상은 격리 DB입니다. DDL을 실행하지 않았습니다. --apply로 적용합니다.",
    );
    return;
  }
  const baseline = await sql.query(
    `SELECT relname,pg_table_size(c.oid)::text AS table_bytes,pg_indexes_size(c.oid)::text AS index_bytes,pg_total_relation_size(c.oid)::text AS total_bytes FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='lotto' AND c.relkind='r' ORDER BY relname`,
  );
  console.log(JSON.stringify({ baseline }));
}
main().catch(() => {
  console.error(
    "마이그레이션 실패: 대상·접속·권한·checksum을 확인하세요. 접속정보와 DB 오류 원문은 출력하지 않습니다.",
  );
  process.exitCode = 1;
});
