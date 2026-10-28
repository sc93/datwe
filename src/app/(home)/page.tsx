import { Metadata } from "next";

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
  const recentDraws = result?.draws ?? [];

  return (
    <LottoDrawsProvider recentDraws={recentDraws}>
      <div className="space-y-8">
        <div className="text-muted-foreground flex min-h-11 flex-wrap items-center justify-between gap-2 border-b pb-4 text-xs">
          <span className="text-primary font-mono text-[10px] tracking-[0.15em]">
            WEEKLY RECORD
          </span>
          <p>
            {result?.latestEpisode
              ? `최근 추첨 제 ${result.latestEpisode}회`
              : "최근 회차를 확인하지 못했어요"}
          </p>
        </div>
        <Option />
        <Numbers />
      </div>

      <GenBtn />
    </LottoDrawsProvider>
  );
}
