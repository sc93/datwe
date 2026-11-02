import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

/** 한 SQL statement의 암시적 트랜잭션 안에서 lock·checksum·DDL·버전을 반영한다. */
export function migrationStatement(version: string, body: string) {
  if (
    !/^\d{3}$/.test(version) ||
    body.includes("$migration$") ||
    body.includes("$ddl$")
  )
    throw Error("migration-input");
  const checksum = createHash("sha256").update(body).digest("hex");
  return `DO $migration$
 DECLARE prior text;
 BEGIN
  PERFORM pg_advisory_xact_lock(2945331);
  CREATE SCHEMA IF NOT EXISTS lotto_migrations;
  REVOKE ALL ON SCHEMA lotto_migrations FROM PUBLIC;
  CREATE TABLE IF NOT EXISTS lotto_migrations.versions(version text PRIMARY KEY,checksum char(64) NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());
  SELECT checksum INTO prior FROM lotto_migrations.versions WHERE version='${version}';
  IF prior IS NOT NULL THEN
   IF prior <> '${checksum}' THEN RAISE EXCEPTION 'migration-checksum'; END IF;
  ELSE
   EXECUTE $ddl$${body}$ddl$;
   INSERT INTO lotto_migrations.versions(version,checksum) VALUES('${version}','${checksum}');
  END IF;
 END $migration$;`;
}

/** 파일명의 세 자리 버전순으로 읽는다. 동일 버전의 중복 파일은 거부한다. */
export async function loadArchiveMigrations() {
  const directory = new URL("../migrations/", import.meta.url);
  const files = (await readdir(directory))
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .sort();
  const versions = files.map((name) => name.slice(0, 3));
  if (!files.length || new Set(versions).size !== files.length)
    throw Error("migration-versions");
  return Promise.all(
    files.map(async (name) => ({
      version: name.slice(0, 3),
      body: await readFile(new URL(name, directory), "utf8"),
    })),
  );
}
