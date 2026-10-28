import { Metadata } from "next";
import { Suspense } from "react";

import { fetchRecentDraws } from "@/lib/lotto-dhlottery";

import GenBtn from "./_components/gen-btn";
import LottoDrawsProvider from "./_components/lotto-draws-provider";
import Numbers from "./_components/numbers";
import Option from "./_components/option";
import RecentDraws from "./_components/recent-draws";
import { RecentDrawsLoading } from "./_components/recent-draws-view";

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

async function DrawsSection() {
  const result = await fetchRecentDraws();
  return (
    <LottoDrawsProvider data={result}>
      <RecentDraws initialData={result} />
    </LottoDrawsProvider>
  );
}

export default function Home() {
  return (
    <>
      <div className="space-y-8">
        <Suspense fallback={<RecentDrawsLoading />}>
          <DrawsSection />
        </Suspense>
        <Option />
        <Numbers />
      </div>
      <GenBtn />
    </>
  );
}
