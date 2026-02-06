"use client";

import BalancedSectionOption from "./options/balanced-section-option";
import BossNameOption from "./options/boss-name-option";
import CarryOverOption from "./options/carry-over-option";
import DiagonalPatternOption from "./options/diagonal-pattern-option";
import IncludeLuckyNumberOption from "./options/include-lucky-number-option";
import NoSerialOption from "./options/no-serial-option";
import OddEvenOption from "./options/odd-even-option";
import RecentFiveOption from "./options/recent-five-option";
import ResignDateOption from "./options/resign-date-option";
import SalaryDayOption from "./options/salary-day-option";
import SumBetweenOption from "./options/sum-between-option";

export default function Option() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-zinc-700">조건 선택</h2>
      <div className="grid grid-cols-3 gap-3">
        <RecentFiveOption />
        <SumBetweenOption />
        <IncludeLuckyNumberOption />
        <ResignDateOption />
        <BossNameOption />
        <SalaryDayOption />
        <OddEvenOption />
        <NoSerialOption />
        <CarryOverOption />
        <BalancedSectionOption />
        <DiagonalPatternOption />
      </div>
    </section>
  );
}
