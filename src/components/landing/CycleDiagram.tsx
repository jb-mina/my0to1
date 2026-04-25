type Stage = {
  num: string;
  title: string;
  tagline: string;
  arrow: string;
  desc: string;
};

const STAGES: Stage[] = [
  {
    num: "01",
    title: "Self Map",
    tagline: "나를 인터뷰하는 시스템",
    arrow: "→ Problem Universe",
    desc: "Agent가 던지는 질문을 통해 관심사·강점·혐오·몰입 경험·접근 가능한 네트워크가 자연스럽게 드러납니다. '나는 어떤 문제에 founder fit이 있는가'에 대한 살아있는 베이스 맵이 누적됩니다.",
  },
  {
    num: "02",
    title: "Problem Universe",
    tagline: "Seed 스타트업 문제 지도",
    arrow: "→ Founder–Problem Fit",
    desc: "세상의 모든 문제가 아닌, 최근 Seed~Series A 국내외 스타트업이 실제로 풀고 있는 문제. 누가/언제/왜 겪는지, 현재 대체재가 무엇인지까지 카드로 정리됩니다.",
  },
  {
    num: "03",
    title: "Founder–Problem Fit",
    tagline: "나와 잘 맞는 문제 큐레이션",
    arrow: "→ Validation Backlog",
    desc: "Self Map × Problem Universe. 끌림·이해도·접근성·장기 동기를 직접 평가하면, Agent가 우선순위 상위 1~3개 문제로 좁혀줍니다.",
  },
  {
    num: "04",
    title: "Validation Backlog",
    tagline: "가장 싸고 빠른 검증 처방",
    arrow: "→ Self Map",
    desc: "문제 존재 / 심각도 / 솔루션 핏 / 지불 의사 — 4가지 가설을 가르는 가장 가벼운 실험을 처방합니다. 인터뷰·스모크 테스트·페이크 도어·소액 선결제·컨시어지 PoC.",
  },
];

export function CycleDiagram() {
  return (
    <>
      {/* Mobile: vertical stack */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {STAGES.map((s) => (
          <StageCard key={s.num} stage={s} compact />
        ))}
      </div>

      {/* Desktop: circular diagram */}
      <div className="relative mx-auto hidden h-[760px] w-full max-w-[860px] md:block">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 860 760"
          aria-hidden
        >
          {/* Outer dashed orbit */}
          <circle
            cx={430}
            cy={380}
            r={300}
            fill="none"
            stroke="#f59e0b"
            strokeOpacity="0.25"
            strokeWidth="1.5"
            strokeDasharray="4 10"
          />
          {/* Inner solid orbit */}
          <circle
            cx={430}
            cy={380}
            r={220}
            fill="none"
            stroke="#f59e0b"
            strokeOpacity="0.85"
            strokeWidth="2.5"
          />
          {/* Center radial glow */}
          <circle
            cx={430}
            cy={380}
            r={120}
            fill="url(#centerGlow)"
            opacity="0.45"
          />
          <defs>
            <radialGradient id="centerGlow">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Clockwise flow arrows on the inner orbit */}
          {/* 12 o'clock: pointing right */}
          <polygon points="430,148 446,160 430,172" fill="#f59e0b" />
          {/* 3 o'clock: pointing down */}
          <polygon points="650,380 638,396 622,380" fill="#f59e0b" />
          {/* 6 o'clock: pointing left */}
          <polygon points="430,612 414,600 430,588" fill="#f59e0b" />
          {/* 9 o'clock: pointing up */}
          <polygon points="210,380 222,364 238,380" fill="#f59e0b" />
        </svg>

        {/* Center label */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-400/80">
            Compounding
          </p>
          <p className="my-1 text-3xl font-bold text-amber-300 md:text-4xl">
            Loop
          </p>
          <p className="text-xs text-white/50">매번 더 또렷</p>
        </div>

        {/* 12 o'clock — Self Map */}
        <div className="absolute left-1/2 top-0 w-64 -translate-x-1/2">
          <StageCard stage={STAGES[0]} />
        </div>
        {/* 3 o'clock — Problem Universe */}
        <div className="absolute right-0 top-1/2 w-64 -translate-y-1/2">
          <StageCard stage={STAGES[1]} />
        </div>
        {/* 6 o'clock — Founder-Problem Fit */}
        <div className="absolute bottom-0 left-1/2 w-64 -translate-x-1/2">
          <StageCard stage={STAGES[2]} />
        </div>
        {/* 9 o'clock — Validation Backlog */}
        <div className="absolute left-0 top-1/2 w-64 -translate-y-1/2">
          <StageCard stage={STAGES[3]} />
        </div>
      </div>
    </>
  );
}

function StageCard({ stage, compact }: { stage: Stage; compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
      <p className="text-2xl font-bold text-amber-400">{stage.num}</p>
      <p className="mt-1 text-lg font-semibold text-white md:text-xl">
        {stage.title}
      </p>
      <p className="mt-1 text-xs text-amber-300/80">{stage.tagline}</p>
      {compact && (
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          {stage.desc}
        </p>
      )}
    </div>
  );
}
