import { revalidateTag } from "next/cache";

import { handleSyncRequest } from "@/lib/server/lotto-archive/admin";
import { runSync } from "@/lib/server/lotto-archive/lotto-sync";
import { createOfficialSource } from "@/lib/server/lotto-archive/source";
import { invalidateDrawCaches } from "@/lib/server/lotto-cache";
import { archiveWriter } from "@/lib/server/lotto-db";

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
      invalidate: (round, latest) =>
        invalidateDrawCaches([round], latest, (tag) =>
          revalidateTag(tag, { expire: 0 }),
        ),
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
