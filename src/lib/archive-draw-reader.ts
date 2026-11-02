import { createDrawReader, type DrawCache } from "./draw-reader";
import { type DrawSchedule, latestValidity } from "./draw-schedule";
import type { createArchiveReader } from "./lotto-archive/store";
import { getLottoDataAtTime, type LottoData } from "./lotto-data";

type Options = {
  database: () => Promise<ReturnType<typeof createArchiveReader>>;
  cache?: DrawCache;
  now?: () => number;
  schedule?: DrawSchedule;
};

/** 공개 경로는 DB/캐시만 읽는다. 실패해도 공식 원천을 호출하지 않는다. */
export function createArchiveDrawReader(options: Options) {
  const now = options.now ?? Date.now;
  const reader = createDrawReader({
    cache: options.cache,
    isFresh: (snapshot, n) =>
      n !== undefined ||
      latestValidity(
        snapshot.draw,
        snapshot.checkedAt,
        now(),
        options.schedule,
      ) !== null,
    loadSnapshot: async (n) => {
      const db = await options.database();
      if (n !== undefined) return db.readRecord(n);
      const latest = await db.readLatest();
      if (latest.round === null || latest.checkedAt === null) return null;
      const snapshot = await db.readRecord(latest.round);
      if (!snapshot) throw Error("latest-record-missing");
      return { ...snapshot, checkedAt: latest.checkedAt };
    },
  });
  return {
    ...reader,
    async readRecent(): Promise<LottoData> {
      const latest = await reader.readLatest();
      if (!latest.draw)
        return {
          status:
            latest.status === "not-collected" ? "not-collected" : "unavailable",
          latestEpisode: null,
          draws: [],
          checkedAt: null,
          missingEpisodes: [],
          validUntil: null,
        };
      const slots = await Promise.all(
        Array.from({ length: Math.min(4, latest.draw.episode - 1) }, (_, i) =>
          reader.readDraw(latest.draw!.episode - i - 1),
        ),
      );
      const draws = [
        latest.draw,
        ...slots.flatMap((slot) => (slot.draw ? [slot.draw] : [])),
      ];
      const missingEpisodes = Array.from(
        { length: Math.min(5, latest.draw.episode) },
        (_, i) => latest.draw!.episode - i,
      ).filter((n) => !draws.some((d) => d.episode === n));
      return getLottoDataAtTime(
        {
          status:
            draws.length === 5 && !missingEpisodes.length ? "fresh" : "partial",
          latestEpisode: latest.draw.episode,
          draws,
          checkedAt: latest.checkedAt,
          missingEpisodes,
          validUntil: latestValidity(
            latest.draw,
            latest.checkedAt,
            now(),
            options.schedule,
          ),
        },
        now(),
      );
    },
  };
}
