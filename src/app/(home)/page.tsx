// app/layout.tsx 또는 app/page.tsx
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
      <div className="min-h-[calc(100vh-140px)] max-w-150 bg-white px-4 pt-5 pb-24">
        <p className="text-right text-base font-semibold text-zinc-500">
          최근 회차: {result?.latestEpisode}
        </p>
        <div className="h-2.5" />
        <Option />
        <Numbers />
      </div>

      <div className="sticky right-0 bottom-0 left-0 z-50 mx-auto h-20 max-w-150 border-t border-zinc-200 bg-white px-4 py-3">
        <GenBtn />
      </div>
    </LottoDrawsProvider>
  );
}
