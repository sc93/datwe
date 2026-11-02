/** 정기 수집과 프로젝트 밖 적재 후 갱신이 같은 캐시 경계를 사용한다. */
export function drawCacheTags(key: string) {
  return key === "latest"
    ? ["lotto-db-latest", "lotto-db-list"]
    : [`lotto-db-round-${key}`];
}
export async function invalidateDrawCaches(
  rounds: number[],
  latest: boolean,
  invalidate: (tag: string) => void | Promise<void>,
) {
  const tags = new Set([
    "lotto-db-list",
    ...rounds.map((n) => `lotto-db-round-${n}`),
  ]);
  if (latest) tags.add("lotto-db-latest");
  for (const tag of tags) await invalidate(tag);
}
