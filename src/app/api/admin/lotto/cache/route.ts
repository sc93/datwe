import { revalidateTag } from "next/cache";

import { handleSyncRequest } from "@/lib/lotto-archive/admin";
import { invalidateDrawCaches } from "@/lib/lotto-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 승인된 외부 적재 후 캐시만 갱신한다. 원천 요청과 DB 쓰기는 하지 않는다. */
export async function POST(request: Request) {
  return handleSyncRequest(
    request,
    "manual",
    process.env,
    async ({ rounds }) => {
      await invalidateDrawCaches(rounds ?? [], true, (tag) =>
        revalidateTag(tag, { expire: 0 }),
      );
      return { status: "success", invalidated: rounds?.length ?? 0 };
    },
  );
}
