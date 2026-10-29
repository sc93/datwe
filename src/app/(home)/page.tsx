import { Suspense } from "react";

import { fetchRecentDraws } from "@/lib/lotto-dhlottery";

import GenBtn from "./_components/gen-btn";
import LottoDrawsProvider from "./_components/lotto-draws-provider";
import Numbers from "./_components/numbers";
import Option from "./_components/option";
import RecentDraws from "./_components/recent-draws";
import { RecentDrawsLoading } from "./_components/recent-draws-view";

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
