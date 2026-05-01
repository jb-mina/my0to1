import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import {
  CORE_CATEGORIES,
  categoryCoverage,
  createInterviewSession,
  findLatestEndedSession,
  firstUnderfilledCategory,
  getLatestSynthesis,
  listSelfMapEntries,
  parseInterviewSession,
  parseSynthesis,
  type CoreCategory,
} from "@/lib/db/self-map";

const client = new Anthropic();

const inputSchema = z.object({
  forceMode: z.enum(["thread", "gap", "tension", "energy"]).optional(),
  forceCategory: z.enum(CORE_CATEGORIES).optional(),
});

type Mode = "thread" | "gap" | "tension" | "energy";

const CATEGORY_LABEL: Record<CoreCategory, string> = {
  interests: "관심사",
  strengths: "강점",
  aversions: "혐오",
  flow: "몰입 경험",
  network: "접근 가능한 네트워크",
  other: "기타",
};

const SELF_INSIGHT_BASE = `당신은 Self Insight Agent입니다. 창업자가 자신을 깊이 이해하도록 돕는 전담 코치입니다. 한 번에 하나의 질문만 하세요. 절대 여러 질문을 동시에 하지 마세요. 조언·해석·요약·공감 코멘트는 피하고, 질문에 집중하세요.`;

function modeSystemPrompt(mode: Mode, ctx: ModeContext): string {
  const base = `${SELF_INSIGHT_BASE}\n\n첫 발화 가이드 (이번 세션의 첫 메시지를 1턴 분량으로 생성하세요):`;
  switch (mode) {
    case "thread": {
      const thread = ctx.thread;
      return `${base}\n- 지난 인터뷰에서 정리되지 않은 화제를 짚으며 이어가세요.\n- 도입부 한 문장: "지난번 대화에서 X에 대해 이야기를 나누다 정리되지 않은 부분이 있었어요."\n- 그 thread를 다시 묻는 한 질문으로 마무리.\n- 미해결 thread 요약: ${thread?.summary ?? "(없음)"}\n- 응답은 자연스러운 한국어 2~4문장 이내.`;
    }
    case "gap": {
      const cat = ctx.targetCategory ?? "interests";
      return `${base}\n- Self Map의 "${CATEGORY_LABEL[cat]}" 영역이 비어있어 이번엔 이 영역을 채우는 데 집중합니다.\n- 도입부 한 문장: "Self Map의 ${CATEGORY_LABEL[cat]} 영역이 비어있는 게 보여요." 같은 톤.\n- ${CATEGORY_LABEL[cat]} 영역에 맞는 한 질문으로 마무리.\n- 응답은 자연스러운 한국어 2~4문장 이내.`;
    }
    case "tension": {
      const t = ctx.tensionPair;
      return `${base}\n- 지난 답변 두 개의 명백한 충돌을 짚으며 이어가세요.\n- 도입부 한 문장: "지난번 답변 두 개가 흥미롭게 충돌해요."\n- 두 답변을 짧게 요약하고 "이 둘이 어떻게 공존하나요?" 류의 한 질문으로 마무리.\n- 충돌 설명: ${t?.description ?? "(없음)"}\n- 응답은 자연스러운 한국어 2~5문장 이내.`;
    }
    case "energy":
    default:
      return `${base}\n- 가벼운 안부형 도입으로 시작하세요. 사용자의 컨디션이나 오늘 떠오르는 생각을 묻는 한 질문으로 마무리.\n- 응답은 자연스러운 한국어 2~3문장 이내.`;
  }
}

function modeHintLine(mode: Mode, ctx: ModeContext): string | undefined {
  switch (mode) {
    case "thread":
      return "지난 대화에서 이어가요";
    case "gap":
      return ctx.targetCategory
        ? `${CATEGORY_LABEL[ctx.targetCategory]} 영역을 더 채워볼게요`
        : undefined;
    case "tension":
      return "지난번 답변의 긴장에서 시작해요";
    case "energy":
    default:
      return undefined;
  }
}

type ModeContext = {
  targetCategory?: CoreCategory;
  thread?: { summary: string; relatedEntryIds: string[] };
  tensionPair?: { entryIdA: string; entryIdB: string; description: string };
};

async function decideMode(force?: { mode?: Mode; category?: CoreCategory }): Promise<{
  mode: Mode;
  modeContext: ModeContext;
}> {
  const entries = await listSelfMapEntries();

  // 0. force override (e.g., Tension/Gap 사이드의 "이 영역으로 인터뷰 가기")
  if (force?.mode === "gap") {
    return { mode: "gap", modeContext: { targetCategory: force.category ?? "interests" } };
  }
  if (force?.mode) {
    return { mode: force.mode, modeContext: {} };
  }

  // Edge: empty Self Map ⇒ always energy.
  if (entries.length === 0) return { mode: "energy", modeContext: {} };

  // 1. Thread continuation — only from sessions that the user explicitly ended.
  const lastSession = await findLatestEndedSession();
  if (lastSession) {
    const parsed = parseInterviewSession(lastSession);
    if (parsed.threadToResume.length > 0) {
      return { mode: "thread", modeContext: { thread: parsed.threadToResume[0] } };
    }
  }

  // 2. Gap — first underfilled core category (network/flow/aversions priority).
  const coverage = categoryCoverage(entries);
  const underfilled = firstUnderfilledCategory(coverage);
  if (underfilled) {
    return { mode: "gap", modeContext: { targetCategory: underfilled } };
  }

  // 3. Tension — surface a synthesis-detected contradiction if present.
  const synthesisRow = await getLatestSynthesis();
  if (synthesisRow) {
    const parsedSynthesis = parseSynthesis(synthesisRow);
    if (parsedSynthesis.tensions.length > 0) {
      return { mode: "tension", modeContext: { tensionPair: parsedSynthesis.tensions[0] } };
    }
  }

  // 4. Fallback.
  return { mode: "energy", modeContext: {} };
}

export async function POST(req: NextRequest) {
  const raw = req.body ? await req.json().catch(() => ({})) : {};
  const parsed = inputSchema.parse(raw);

  const decided = await decideMode({ mode: parsed.forceMode, category: parsed.forceCategory });
  const { mode, modeContext } = decided;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: modeSystemPrompt(mode, modeContext),
    messages: [
      {
        role: "user",
        content:
          "이번 세션을 시작합니다. 위 가이드대로 첫 발화 한 턴만 작성하세요. JSON 없이 자연스러운 한국어로.",
      },
    ],
  });

  const firstMessage =
    response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

  if (!firstMessage) {
    return NextResponse.json({ error: "empty response from agent" }, { status: 502 });
  }

  const conversationSessionId = `self-${randomUUID()}`;
  const session = await createInterviewSession({
    mode,
    modeContext: modeContext as Record<string, unknown>,
    conversationSessionId,
  });

  await prisma.agentConversation.create({
    data: {
      agentType: "self-insight",
      role: "assistant",
      content: firstMessage,
      sessionId: conversationSessionId,
    },
  });

  return NextResponse.json({
    interviewSessionId: session.id,
    conversationSessionId,
    mode,
    modeContext,
    firstMessage,
    modeHintLine: modeHintLine(mode, modeContext),
  });
}
