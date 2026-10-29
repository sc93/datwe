"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { LOTTO_OPTION_IDS } from "../_lib/lotto-conditions";
import { useLottoStore } from "../_store/lotto-store";
import CandidateNumbers from "./candidate-numbers";
import BalancedSectionOption from "./options/balanced-section-option";
import BossNameOption from "./options/boss-name-option";
import CarryOverOption from "./options/carry-over-option";
import DiagonalPatternOption from "./options/diagonal-pattern-option";
import IncludeLuckyNumberOption from "./options/include-lucky-number-option";
import NoSerialOption from "./options/no-serial-option";
import OddEvenOption from "./options/odd-even-option";
import RecentFiveOption from "./options/recent-five-option";
import SumBetweenOption from "./options/sum-between-option";

export default function Option() {
  const [isOpen, setIsOpen] = useState(false);
  const checked = useLottoStore((s) => s.checked);
  const resetOptions = useLottoStore((s) => s.resetOptions);
  const error = useLottoStore((s) => s.error);
  const labels = {
    "include-lucky-number": "행운 번호",
    "boss-name-exclusion": "이름 번호",
    "resign-date-hash": "퇴사일",
    "salary-day-energy": "월급날",
    "recent-5-times-not-appeared": "최근 5회 제외",
    "carry-over-one": "직전 1개",
    "sum-between-100-and-170": "합계 100~170",
    "odd-even-balanced": "홀짝 비율",
    "no-serial-numbers": "3연번 제한",
    "balanced-section": "구간별 분포",
    "diagonal-pattern": "직선·대각선 제한",
  };
  const summary = LOTTO_OPTION_IDS.filter((id) => checked[id]).map(
    (id) => labels[id],
  );
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
      <div className="relative">
        <details
          className="group/options rounded-xl border p-3"
          onToggle={(event) => setIsOpen(event.currentTarget.open)}
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 pr-14 text-sm group-open/options:pr-0 [&::-webkit-details-marker]:hidden">
            <span className="shrink-0 font-semibold">
              <span
                aria-hidden="true"
                className="mr-2 inline-block transition-transform group-open/options:rotate-90 motion-reduce:transition-none"
              >
                ▸
              </span>
              번호 조건
            </span>
            <span className="text-muted-foreground min-w-0 text-right text-xs group-open/options:hidden">
              {summary.length
                ? `선택 ${summary.length}개: ${summary.join(" · ")}`
                : "선택 없음"}
            </span>
          </summary>
          <div className="bg-muted mb-4 flex items-start justify-between gap-3 rounded-xl p-3">
            <p className="text-sm" aria-live="polite">
              {summary.length
                ? `선택 ${summary.length}개: ${summary.join(" · ")}`
                : "선택한 조건 없음 · 입력 없이 생성할 수 있어요."}
            </p>
            <Button
              variant="ghost"
              className="min-h-11 shrink-0"
              onClick={resetOptions}
              disabled={!summary.length}
            >
              초기화
            </Button>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">개인 번호</legend>
            <p className="text-muted-foreground text-xs">
              나만의 의미를 담은 번호를 꼭 포함해요.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <IncludeLuckyNumberOption />
              <BossNameOption />
            </div>
          </fieldset>
          <h3 className="mt-4 mb-2 text-sm font-semibold">조합 조건</h3>
          <p className="text-muted-foreground mb-3 text-xs">
            원하는 규칙만 선택하세요. 최근 5회 제외와 직전 1개 포함은 함께
            선택할 수 없어요.
          </p>
          <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3">
            <RecentFiveOption />
            <CarryOverOption />
            <SumBetweenOption />
            <OddEvenOption />
            <NoSerialOption />
            <BalancedSectionOption />
            <DiagonalPatternOption />
          </div>
          <div className="text-muted-foreground mt-3 space-y-2 text-xs leading-5">
            <p>
              최근 5회 제외: 연속 5회의 본번호를 제외해요. 보너스 번호는 제외
              대상이 아니에요. 직전 1개 포함: 직전 본번호에서 정확히 1개만
              넣어요.
            </p>
            <p>
              숫자 합은 100과 170을 포함해요. 홀수와 짝수 개수의 합은 항상
              6개예요. 3연번 제한은 연속된 숫자 3개 이상을 제외해요.
            </p>
            <p>
              번호대별 분포: 1~9 / 10~19 / 20~29 / 30~39 / 40~45에서 각각 최소
              1개를 넣어요.
            </p>
            <p>
              직선·대각선 마킹 제한: 1부터 가로로 채운 5열×9행에서
              가로·세로·45도 대각선 위의 세 점을 제외해요. 떨어진 점도 포함하며
              실제 용지 규격을 뜻하지 않아요.
            </p>
          </div>
        </details>
        {!isOpen && (
          <Button
            variant="ghost"
            className="absolute top-3 right-3 min-h-11 px-2 text-xs"
            onClick={resetOptions}
            disabled={!summary.length}
          >
            초기화
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <CandidateNumbers />
    </section>
  );
}
