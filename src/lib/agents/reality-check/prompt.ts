import type { Hypothesis, OnePager, ProblemCard, SolutionHypothesis } from "@prisma/client";

// 3-persona challenge + moderator. CLAUDE.md §3:
// - Personas do NOT see each other's outputs. Only the moderator does.
// - Critique must accompany a counter-question or next action.
// - Cold investor: numbers/market-sized, no emotion.
// - Honest friend: motivation/energy, empathic but not soothing.
// - Socratic: questions only, no assertions.
// - Moderator: surfaces tension, doesn't reconcile.
export const PERSONAS = {
  coldInvestor: {
    name: "냉정한 투자자",
    system: `당신은 10년 경력의 냉정한 VC 투자자입니다. 감정 없이 사실과 데이터로만 판단합니다.
창업자가 추구하는 솔루션 가설과 그 검증 처방·1-pager(있다면)을 보고 투자 관점에서 가장 치명적인 약점과 리스크를 지적하세요.
희망사항이나 가정에 도전하고, 더 강한 증거가 필요한 부분을 명확히 짚어주세요.
지적할 때는 반드시 그 약점을 깨거나 보강하기 위한 다음 액션(또는 반증 질문) 1개를 함께 제시하세요.
한국어로 3-4문장으로 답하세요.`,
  },
  honestFriend: {
    name: "솔직한 친구",
    system: `당신은 창업 경험이 있는 솔직한 친구입니다. 응원하지만 거짓말은 하지 않습니다.
창업자가 추구하는 솔루션 가설과 그 검증·1-pager(있다면)을 친구 입장에서 솔직하게 평가하세요.
좋은 점 1가지 + 걱정되는 점 2가지를 솔직하게 말해주세요.
걱정되는 점에는 각각 어떻게 확인·완화할 수 있는지 한 줄을 함께 적어주세요.
한국어로 3-4문장으로 답하세요.`,
  },
  socraticQ: {
    name: "소크라테스식 질문자",
    system: `당신은 소크라테스식 질문으로 창업자가 스스로 생각하게 만드는 멘토입니다.
창업자의 솔루션 가설과 1-pager(있다면)에서 검증되지 않은 가정을 찾아내고, 그것을 확인할 수 있는 날카로운 질문 3개를 던지세요.
직접 평가하거나 답을 주지 말고, 질문만 하세요.
한국어로 질문 3개만 답하세요.`,
  },
} as const;

export type PersonaKey = keyof typeof PERSONAS;

export const MODERATOR_SYSTEM = `당신은 중재자입니다. 세 관점(투자자, 친구, 소크라테스)의 의견을 종합해 창업자에게 가장 중요한 다음 액션 1-2개를 제안하세요.
세 관점 사이의 긴장이 있다면 짚되, 억지로 수렴시키지는 마세요.
한국어로 2-3문장.`;

function summarizeHypotheses(hypotheses: Hypothesis[]): string {
  if (hypotheses.length === 0) return "(아직 처방된 가설이 없음)";
  return hypotheses
    .map((h) => {
      const methods = (() => {
        try {
          return (JSON.parse(h.prescribedMethods) as string[]).join(", ");
        } catch {
          return h.prescribedMethods;
        }
      })();
      const findings = h.findings ? `\n  findings: ${h.findings.slice(0, 200)}` : "";
      return `- ${h.axis} (${h.status}): methods=${methods}; success=${h.successSignals}; failure=${h.failureSignals}${findings}`;
    })
    .join("\n");
}

function onePagerBlock(onePager: OnePager | null): string {
  if (!onePager) return "(1-pager 없음 — 솔루션 statement + 4축 검증 상태로만 판단)";
  return `한줄 요약: ${onePager.oneLineSummary || "(빈칸)"}
타깃 고객: ${onePager.targetCustomer || "(빈칸)"}
문제: ${onePager.problem || "(빈칸)"}
솔루션: ${onePager.solution || "(빈칸)"}
MVP 범위: ${onePager.mvpScope || "(빈칸)"}
MVP 구현 비용: ${onePager.mvpCostEstimate || "(빈칸)"}
운영 모델: ${onePager.operatingModel || "(빈칸)"}
수익화 가설: ${onePager.monetization || "(빈칸)"}
주요 리스크 3개:
${onePager.topRisks || "(빈칸)"}
30일 이내 검증 액션:
${onePager.validationActions30d || "(빈칸)"}`;
}

// Personas and moderator share the same context block — that's the unit RC
// reasons over. Personas don't see each other's output (CLAUDE.md §3); only
// the moderator builds on top via a separate message.
export function buildContext(input: {
  card: ProblemCard;
  solution: SolutionHypothesis;
  hypotheses: Hypothesis[];
  onePager: OnePager | null;
}): string {
  const { card, solution, hypotheses, onePager } = input;
  return `창업자가 추구하는 솔루션 가설과 검증 상황:

문제: ${card.title}
대상 고객: ${card.who}
핵심 불편함: ${card.painPoints}

솔루션 가설:
${solution.statement}

솔루션 단위 가설 검증 상태:
${summarizeHypotheses(hypotheses)}

1-pager (사업화 사고 풀 컨텍스트):
${onePagerBlock(onePager)}`;
}

export function buildModeratorMessage(
  context: string,
  personaOutputs: { coldInvestor: string; honestFriend: string; socraticQ: string },
): string {
  return `원본 컨텍스트:
${context}

냉정한 투자자:
${personaOutputs.coldInvestor}

솔직한 친구:
${personaOutputs.honestFriend}

소크라테스식 질문자:
${personaOutputs.socraticQ}`;
}
