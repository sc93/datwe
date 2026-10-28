import { Metadata } from "next";

import { getDrawAvailability } from "@/lib/lotto-data";
import { fetchRecentDraws } from "@/lib/lotto-dhlottery";

import GenBtn from "./_components/gen-btn";
import LottoDrawsProvider from "./_components/lotto-draws-provider";
import Numbers from "./_components/numbers";
import Option from "./_components/option";

export const metadata: Metadata = {
  title: "다음주 퇴사 | 로또 번호 생성기",
  description: "내가 하고 싶은 조합으로 로또번호 만들고 다음주에 퇴사한다",
  keywords: [
    "로또번호생성기",
    "퇴사",
    "사직서",
    "로또당첨",
    "로또분석",
    "직장인운세",
    "다퇴",
    "동행복권",
    "온라인 복권 구매",
  ],
  openGraph: {
    title: "다음주 퇴사 | 로또 번호 생성기",
    description: "내가 하고 싶은 조합으로 로또번호 만들고 다음주에 퇴사한다",
    url: "https://datwe.vercel.app",
    siteName: "다퇴 (DATWE)",

    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "다음주 퇴사 | 로또 번호 생성기",
    description: "내가 하고 싶은 조합으로 로또번호 만들고 다음주에 퇴사한다",
  },
  icons: {
    icon: "/favicon.ico", // 'ㄷㅌ' 로고를 활용한 파비콘
  },
};

export default async function Home() {
  const result = await fetchRecentDraws();
  const recentDraws = getDrawAvailability(result).recentFive
    ? [...result.draws].reverse().map((draw) => draw.numbers)
    : [];
  const statusText =
    result.status === "fresh"
      ? `최근 추첨 제 ${result.latestEpisode}회`
      : result.status === "stale"
        ? `제 ${result.latestEpisode}회 기록 · 갱신 지연`
        : result.status === "partial"
          ? `확인된 제 ${result.latestEpisode}회 · 일부 기록 누락`
          : "최근 회차를 확인하지 못했어요";

  return (
    <LottoDrawsProvider recentDraws={recentDraws}>
      <div className="space-y-8">
        <div className="text-muted-foreground flex min-h-11 flex-wrap items-center justify-between gap-2 border-b pb-4 text-xs">
          <span className="text-primary font-mono text-[10px] tracking-[0.15em]">
            WEEKLY RECORD
          </span>
          <p>{statusText}</p>
          {result.status !== "fresh" && (
            <p role="status" className="w-full text-xs leading-5">
              {result.status === "stale"
                ? "마지막으로 확인한 기록이에요. 최신 회차 조건은 갱신 후 사용할 수 있어요."
                : result.status === "partial"
                  ? "최근 5회 기록이 모두 확인되지 않아 최근 번호 제외 조건은 사용할 수 없어요."
                  : "잠시 후 다시 확인해 주세요. 일반 번호 생성은 사용할 수 있어요."}
              {result.checkedAt && (
                <span className="mt-1 block">
                  마지막 확인:{" "}
                  {new Intl.DateTimeFormat("ko-KR", {
                    timeZone: "Asia/Seoul",
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(result.checkedAt))}
                </span>
              )}
            </p>
          )}
        </div>
        <Option />
        <Numbers />
      </div>

      <GenBtn />
    </LottoDrawsProvider>
  );
}
