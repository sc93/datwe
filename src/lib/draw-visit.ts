let searched: number | null = null;
export function expectSearchVisit(episode: number, confirmedEpisode?: number) {
  searched = episode === confirmedEpisode ? null : episode;
  return episode === confirmedEpisode;
}
/** 검색 제출 자체가 아니라 확인된 대상 상세가 표시될 때만 성공으로 소비한다. */
export function consumeSearchVisit(episode: number) {
  const matches = searched === episode;
  searched = null;
  return matches;
}
