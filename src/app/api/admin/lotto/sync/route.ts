import { revalidateTag } from "next/cache";

import { handleSyncRequest } from "@/lib/lotto-archive/admin";
import { createOfficialSource } from "@/lib/lotto-archive/source";
import { archiveWriter } from "@/lib/lotto-db";
import { runSync } from "@/lib/lotto-sync";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

function handle(request: Request, kind: "daily" | "manual") {
  return handleSyncRequest(request, kind, process.env, async (input) => {
    const deadlineAt = Date.now() + 20000;
    const signal = AbortSignal.timeout(20000);
    const store = await archiveWriter(signal);
    const summary = await runSync({
      ...input,
      store,
      signal,
      deadlineAt,
      source: createOfficialSource(),
      invalidate: async (round, latest) => {
        revalidateTag(`lotto-db-round-${round}`, { expire: 0 });
        revalidateTag("lotto-db-list", { expire: 0 });
        if (latest) revalidateTag("lotto-db-latest", { expire: 0 });
      },
    });
    console.info(JSON.stringify({ event: "lotto-sync", ...summary }));
    return summary;
  });
}
/** Cron용 GET. 공개 회차 GET과 독립된 관리 인증 경로다. */
export async function GET(request: Request) {
  return handle(request, "daily");
}
export async function POST(request: Request) {
  return handle(request, "manual");
}
