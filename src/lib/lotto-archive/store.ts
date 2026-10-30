import type { LottoDraw } from "../lotto-data";
import {
  canonicalDraw,
  drawHash,
  type FailureCode,
  SyncError,
  type VerifiedDraw,
} from "./source";

export type Query = (
  sql: string,
  params?: unknown[],
) => Promise<Record<string, unknown>[]>;
export type Lease = { owner: string; token: number };
export type Plan = {
  latest: number | null;
  latestCheckedAt: string | null;
  latestRetryAt: string | null;
  usage: number | null;
  failures: number[];
  missing: number[];
  pending: { round: number; latest: boolean }[];
};
export type RunStatus = "success" | "partial" | "failed" | "skipped";
export type ArchiveStore = ReturnType<typeof createArchiveStore>;

export function createArchiveStore(query: Query) {
  async function execute(sql: string, params: unknown[]) {
    try {
      return await query(sql, params);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const code = (
        [
          "lease-lost",
          "request-budget",
          "usage-limit",
          "latest-regression",
        ] as const
      ).find((code) => message.includes(code));
      throw new SyncError(code ?? "storage");
    }
  }
  async function action(lease: Lease, name: string, data: unknown = {}) {
    const rows = await execute(
      "SELECT lotto.sync_action($1::uuid,$2::bigint,$3,$4::jsonb) AS result",
      [lease.owner, lease.token, name, JSON.stringify(data)],
    );
    return rows[0].result;
  }
  return {
    async acquire(owner: string, kind: "daily" | "manual" | "backfill") {
      const rows = await execute(
        "SELECT lotto.acquire_sync($1::uuid,$2) AS result",
        [owner, kind],
      );
      const acquired = rows[0].result as { token: number } | null;
      return acquired ? { owner, token: acquired.token } : null;
    },
    async plan(lease: Lease) {
      return (await action(lease, "plan")) as Plan;
    },
    async reserve(lease: Lease, round?: number) {
      return (await action(lease, "reserve", { round })) as {
        allowed?: boolean;
      };
    },
    async save(lease: Lease, record: VerifiedDraw, latest: boolean) {
      const draw = canonicalDraw(record.draw);
      const url = new URL(record.sourceUrl);
      if (
        url.origin !== "https://www.dhlottery.co.kr" ||
        !Number.isFinite(Date.parse(record.verifiedAt))
      )
        throw new SyncError("invalid");
      return (await action(lease, "save", {
        ...record,
        draw,
        latest,
        hash: drawHash(draw),
      })) as { changed: boolean };
    },
    async failure(
      lease: Lease,
      round: number | undefined,
      code: FailureCode,
      retryAt?: string,
    ) {
      await action(lease, "failure", { round, code, retryAt });
    },
    async invalidated(lease: Lease, round: number) {
      await action(lease, "invalidated", { round });
    },
    async finish(lease: Lease, status: RunStatus, code?: FailureCode) {
      await action(lease, "finish", { status, code });
    },
  };
}

/** #31에서 공개 reader에 연결한다. 수집/관리 테이블을 조회하지 않는다. */
export function createArchiveReader(query: Query) {
  return {
    async readDraw(round: number): Promise<LottoDraw | null> {
      if (!Number.isInteger(round) || round < 1 || round > 2147483647)
        return null;
      const rows = await query(
        "SELECT round,draw_date::text,number_1,number_2,number_3,number_4,number_5,number_6,bonus FROM lotto.draws WHERE round=$1",
        [round],
      );
      const r = rows[0];
      return r
        ? canonicalDraw({
            episode: Number(r.round),
            drawDate: String(r.draw_date),
            numbers: [1, 2, 3, 4, 5, 6].map((n) => Number(r[`number_${n}`])),
            bonus: Number(r.bonus),
          })
        : null;
    },
    async readLatest() {
      const [row] = await query(
        "SELECT latest_confirmed_round,latest_checked_at FROM lotto.latest",
      );
      return {
        round:
          row.latest_confirmed_round === null
            ? null
            : Number(row.latest_confirmed_round),
        checkedAt:
          row.latest_checked_at === null
            ? null
            : new Date(String(row.latest_checked_at)).toISOString(),
      };
    },
  };
}
