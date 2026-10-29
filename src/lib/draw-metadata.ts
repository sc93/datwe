import type { Metadata } from "next";

import { SITE_ORIGIN } from "./analytics-page";
import type { DrawDetailData } from "./draw-detail";
import { drawHref, listHref } from "./draw-navigation";
import type { DrawRangeResult } from "./draw-reader";
function metadata(
  title: string,
  description: string,
  path: string,
  index: boolean,
): Metadata {
  const url = SITE_ORIGIN + path;
  return {
    title: `${title} | DATWE 다음주 퇴사`,
    description,
    alternates: { canonical: url },
    robots: { index, follow: true },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "DATWE 다음주 퇴사",
      title,
      description,
      url,
    },
    twitter: { card: "summary", title, description },
  };
}
export function invalidDrawMetadata() {
  return metadata(
    "주소 확인",
    "올바른 회차 주소를 확인하고 당첨번호 목록으로 돌아가세요.",
    "/draw",
    false,
  );
}
export function drawListMetadata(data: DrawRangeResult, to?: number) {
  const confirmed = data.status === "fresh";
  const title = confirmed ? "회차별 당첨번호" : "당첨번호 조회 상태";
  const description = confirmed
    ? `제 ${data.to}회부터 제 ${data.from}회까지 로또 당첨번호와 합계·홀짝·연속 번호를 확인하세요.`
    : "당첨번호 기록을 모두 확인하지 못했습니다. 조회 상태를 확인하거나 다시 시도해 주세요.";
  return metadata(title, description, listHref(to), confirmed);
}
export function drawDetailMetadata(data: DrawDetailData, episode: number) {
  const confirmed = data.target.status === "fresh" && !!data.target.draw;
  return metadata(
    confirmed ? `제 ${episode}회 당첨번호` : "당첨번호 조회 상태",
    confirmed
      ? `제 ${episode}회 로또 당첨번호·보너스와 7개 조합 조건의 충족 여부 및 판정 근거를 확인하세요.`
      : "해당 회차의 정상 기록을 확인하지 못했습니다. 조회 상태를 확인하거나 다시 시도해 주세요.",
    drawHref(episode),
    confirmed,
  );
}
