import { unstable_cache } from "next/cache";
import { connection } from "next/server";

import {
  CACHE_SECONDS,
  readLottoData,
  requireCompleteLottoData,
} from "./lotto-reader";

// 프로세스 메모리 대신 Next Data Cache를 사용한다. 정상인 연속 5회만 저장한다.
const getCompleteSnapshot = unstable_cache(
  () => requireCompleteLottoData(),
  ["lotto-recent-five-v1"],
  { revalidate: CACHE_SECONDS, tags: ["lotto-draws"] },
);

export async function fetchRecentDraws() {
  // 상태 표시 시각은 요청마다 평가한다. 연결 정보는 캐시 콜백 안에서 읽지 않는다.
  await connection();
  return readLottoData(getCompleteSnapshot);
}
