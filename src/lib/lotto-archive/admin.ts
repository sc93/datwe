import { timingSafeEqual } from "node:crypto";

export type Environment = Record<string, string | undefined>;
export function checkDatabaseTarget(
  raw: string | undefined,
  target: "production" | "isolated",
  env: Environment,
  migration = false,
) {
  if (!raw) throw Error("database-config");
  const url = new URL(raw);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.password ||
    !url.pathname.slice(1) ||
    url.searchParams.get("sslmode") !== "require"
  )
    throw Error("database-config");
  const normalized = (host: string) =>
    host.toLowerCase().replace("-pooler.", ".");
  const host = normalized(url.hostname);
  const expected =
    target === "production"
      ? env.DATABASE_PRODUCTION_HOST
      : env.DATABASE_ISOLATED_HOST;
  if (!expected || host !== normalized(expected))
    throw Error("database-target");
  if (
    target === "isolated" &&
    (!env.DATABASE_PRODUCTION_HOST ||
      host === normalized(env.DATABASE_PRODUCTION_HOST))
  )
    throw Error("database-target");
  if (
    !migration &&
    /^(neondb_owner|postgres|.*owner)$/i.test(decodeURIComponent(url.username))
  )
    throw Error("database-role");
  return host;
}
function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handleSyncRequest(
  request: Request,
  kind: "daily" | "manual",
  env: Environment,
  run: (input: {
    kind: "daily" | "manual";
    rounds?: number[];
  }) => Promise<unknown>,
) {
  const secret = env.CRON_SECRET;
  if (!secret || secret.length < 32)
    return json({ error: "관리 인증이 설정되지 않았습니다." }, 503);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return json({ error: "인증이 필요합니다." }, 401);
  if (env.VERCEL_ENV !== "production" || env.LOTTO_ARCHIVE_ENABLED !== "true")
    return json({ error: "이 환경에서는 수집을 실행할 수 없습니다." }, 403);
  try {
    checkDatabaseTarget(env.DATABASE_WRITE_URL, "production", env);
  } catch {
    return json({ error: "DB 대상 설정을 확인해야 합니다." }, 503);
  }
  let rounds: number[] | undefined;
  if (kind === "manual") {
    try {
      if (Number(request.headers.get("content-length")) > 1024)
        return json({ error: "잘못된 관리 요청입니다." }, 400);
      const text = await request.text();
      if (text.length > 1024)
        return json({ error: "잘못된 관리 요청입니다." }, 400);
      const body: unknown = JSON.parse(text);
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => key !== "rounds")
      )
        throw Error();
      const input = (body as { rounds?: unknown }).rounds;
      if (
        input !== undefined &&
        (!Array.isArray(input) ||
          input.length > 2 ||
          !input.every(
            (n) =>
              typeof n === "number" &&
              Number.isInteger(n) &&
              n >= 1 &&
              n <= 2147483647,
          ))
      )
        throw Error();
      rounds =
        input === undefined ? undefined : [...new Set(input as number[])];
    } catch {
      return json(
        { error: "회차는 양의 정수로 최대 2개까지 지정할 수 있습니다." },
        400,
      );
    }
  }
  try {
    return json(await run({ kind, rounds }));
  } catch {
    return json({ error: "관리 작업을 완료하지 못했습니다." }, 503);
  }
}
