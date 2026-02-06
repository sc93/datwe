// app/layout.tsx 또는 app/page.tsx
import { Metadata } from "next";

import GenBtn from "./_components/gen-btn";
import LottoDrawsProvider from "./_components/lotto-draws-provider";
import Numbers from "./_components/numbers";
import Option from "./_components/option";
import { fetchLast6Draws } from "./_lib/lotto-api";

export const metadata: Metadata = {
  title: "다퇴 | 다음 주엔 퇴사한다 - 로또 번호 만들기",
  description: "내가 하고 싶은 조합으로 로또번호 만들기",
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
  authors: [{ name: "다퇴 팀" }],
  openGraph: {
    title: "다퇴 | 다음 주엔 퇴사한다 - 로또 번호 만들기",
    description: "내가 하고 싶은 조합으로 로또번호 만들기",
    url: "https://datwe.vercel.app",
    siteName: "다퇴 (DATWE)",

    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "다퇴 | 다음 주엔 퇴사한다 - 로또 번호 만들기",
    description: "내가 하고 싶은 조합으로 로또번호 만들기",
  },
  icons: {
    icon: "/favicon.ico", // 'ㄷㅌ' 로고를 활용한 파비콘
  },
};

/** 동행복권 기준 마지막 회차 (필요 시 수동 갱신) */
const LAST_DRAW = 1209;

export default async function Home() {
  const recentDraws = await fetchLast6Draws(LAST_DRAW);

  return (
    <LottoDrawsProvider recentDraws={recentDraws}>
      <div className="min-h-[calc(100vh-140px)] bg-white px-4 pt-5 pb-24">
        <Option />
        <Numbers />
      </div>

      <div className="sticky right-0 bottom-0 left-0 z-50 mx-auto h-20 max-w-2xl border-t border-zinc-200 bg-white px-4 py-3">
        <GenBtn />
      </div>
    </LottoDrawsProvider>
  );
}
