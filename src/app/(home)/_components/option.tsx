"use client";

import CandidateNumbers from "./candidate-numbers";
import BalancedSectionOption from "./options/balanced-section-option";
import BossNameOption from "./options/boss-name-option";
import CarryOverOption from "./options/carry-over-option";
import DiagonalPatternOption from "./options/diagonal-pattern-option";
import IncludeLuckyNumberOption from "./options/include-lucky-number-option";
import NoSerialOption from "./options/no-serial-option";
import OddEvenOption from "./options/odd-even-option";
import RecentFiveOption from "./options/recent-five-option";
// import ResignDateOption from "./options/resign-date-option";
// import SalaryDayOption from "./options/salary-day-option";
import SumBetweenOption from "./options/sum-between-option";

export default function Option() {
  return (
    <section className="space-y-3">
      <div>
        <span className="text-primary font-mono text-[10px] tracking-[0.15em]">
          YOUR CHOICE
        </span>
        <h2 className="mt-1 text-xl font-bold tracking-tight">내 번호 조건</h2>
        <p className="text-muted-foreground mt-2 text-xs">
          조건 없이 바로 생성해도 좋아요.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 min-[480px]:gap-3">
        <RecentFiveOption />
        <SumBetweenOption />
        <IncludeLuckyNumberOption />
        {/* <ResignDateOption /> */}
        <BossNameOption />
        {/* <SalaryDayOption /> */}
        <OddEvenOption />
        <NoSerialOption />
        <CarryOverOption />
        <BalancedSectionOption />
        <DiagonalPatternOption />
      </div>

      <CandidateNumbers />
    </section>
  );
}
