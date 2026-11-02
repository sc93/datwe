// 기존 공개 호출 경로를 유지하되 DB/캐시 reader로만 연결한다.
export { fetchRecentDatabaseDraws as fetchRecentDraws } from "./draw-dhlottery";
