"use client";

import type { Synthesis } from "./FounderIdentityCard";

type SelfMapEntry = { id: string; question: string };

const CATEGORY_LABEL: Record<string, string> = {
  interests: "관심사",
  strengths: "강점",
  aversions: "혐오",
  flow: "몰입 경험",
  network: "네트워크",
  other: "기타",
};

function tensionKey(entryIdA: string, entryIdB: string): string {
  return [entryIdA, entryIdB].sort().join("|");
}

export function TensionGapSide({
  synthesis,
  entries,
  onCiteClick,
  onDismissTension,
  onStartGapInterview,
}: {
  synthesis: Synthesis;
  entries: SelfMapEntry[];
  onCiteClick?: (entryId: string) => void;
  onDismissTension: (key: string) => Promise<void>;
  onStartGapInterview: (category: string) => void;
}) {
  // dismissedTensionKeys client-side filter — avoids a second LLM round-trip
  // when the user marks something as "not actually a conflict". The keys are
  // re-injected to the synthesizer the next time it runs, so the same pair
  // won't resurface.
  const visibleTensions = synthesis.tensions.filter(
    (t) => !synthesis.dismissedTensionKeys.includes(tensionKey(t.entryIdA, t.entryIdB)),
  );

  if (visibleTensions.length === 0 && synthesis.gaps.length === 0) return null;

  return (
    <div className="space-y-3">
      {visibleTensions.map((t) => {
        const key = tensionKey(t.entryIdA, t.entryIdB);
        const a = entries.find((e) => e.id === t.entryIdA);
        const b = entries.find((e) => e.id === t.entryIdB);
        return (
          <div key={key} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] font-medium text-amber-700">긴장</span>
            </div>
            <p className="text-xs text-body leading-relaxed">{t.description}</p>
            <div className="flex flex-wrap items-center gap-1 mt-2 text-[11px]">
              <button
                onClick={() => onCiteClick?.(t.entryIdA)}
                className="underline text-amber-700 hover:text-amber-900"
              >
                {a?.question.slice(0, 18) ?? t.entryIdA.slice(0, 6)}
              </button>
              <span className="text-amber-600">↔</span>
              <button
                onClick={() => onCiteClick?.(t.entryIdB)}
                className="underline text-amber-700 hover:text-amber-900"
              >
                {b?.question.slice(0, 18) ?? t.entryIdB.slice(0, 6)}
              </button>
            </div>
            <button
              onClick={() => onDismissTension(key)}
              className="mt-2 text-[10px] text-subtle hover:text-red-500 transition-colors"
            >
              이건 충돌 아니에요
            </button>
          </div>
        );
      })}

      {synthesis.gaps.map((g) => {
        const label = CATEGORY_LABEL[g.category] ?? g.category;
        return (
          <div key={g.category} className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] font-medium text-blue-700">갭</span>
              <span className="text-xs font-medium text-foreground">{label} 영역이 비어있어요</span>
            </div>
            <p className="text-xs text-body leading-relaxed">{g.reason}</p>
            <button
              onClick={() => onStartGapInterview(g.category)}
              className="mt-2 text-[11px] text-violet-600 underline hover:text-violet-700 transition-colors"
            >
              이 영역으로 인터뷰 가기
            </button>
          </div>
        );
      })}
    </div>
  );
}
