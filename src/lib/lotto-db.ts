import "server-only";

import { neon } from "@neondatabase/serverless";

import { checkDatabaseTarget } from "./lotto-archive/admin";
import {
  createArchiveReader,
  createArchiveStore,
  type Query,
} from "./lotto-archive/store";

/** URL과 드라이버 오류를 호출자·로그로 전달하지 않는다. */
async function connection(
  role: "reader" | "writer",
  signal: AbortSignal,
): Promise<Query> {
  const raw =
    role === "writer"
      ? process.env.DATABASE_WRITE_URL
      : process.env.DATABASE_READ_URL;
  const target =
    process.env.VERCEL_ENV === "production" ? "production" : "isolated";
  checkDatabaseTarget(raw, target, process.env);
  const sql = neon(raw!, { fetchOptions: { signal } });
  const [permissions] = await sql.query(
    `SELECT
    pg_has_role(current_user,$1,'MEMBER') AS member,
    has_schema_privilege(current_user,'lotto','CREATE') AS can_create,
    (SELECT rolsuper OR rolcreaterole OR rolcreatedb FROM pg_roles WHERE rolname=current_user) AS elevated,
    pg_has_role(current_user,'neon_superuser','MEMBER') AS neon_admin`,
    [`lotto_${role}`],
  );
  if (
    !permissions.member ||
    permissions.can_create ||
    permissions.elevated ||
    permissions.neon_admin
  )
    throw Error("database-role");
  if (role === "reader") {
    const [access] = await sql.query(
      "SELECT has_table_privilege(current_user,'lotto.draws','INSERT') AS can_write, has_table_privilege(current_user,'lotto.sync_state','SELECT') AS can_manage",
    );
    if (access.can_write || access.can_manage) throw Error("database-role");
  }
  return async (text, params) => sql.query(text, params);
}
export async function archiveWriter(signal: AbortSignal) {
  return createArchiveStore(await connection("writer", signal));
}
export async function archiveReader(signal: AbortSignal) {
  return createArchiveReader(await connection("reader", signal));
}
