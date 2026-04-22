"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Crosshair, Loader2, X, ExternalLink, Telescope } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ProblemCard = {
  id: string;
  title: string;
  who: string;
  when: string;
  why: string;
  painPoints: string;
  alternatives: string;
  source: string;
  sourceUrl: string;
  tags: string;
  stage: string;
  category: string;
  fitEvaluations: { totalScore: number }[];
};

const SOURCE_LABELS: Record<string, string> = {
  yc: "YC", sequoia: "Sequoia", a16z: "a16z",
  producthunt: "Product Hunt", appstore: "App Store", manual: "직접 추가",
};


function AddCardModal({ onClose, onSave }: { onClose: () => void; onSave: (data: Partial<ProblemCard>) => void }) {
  const [form, setForm] = useState({
    title: "", who: "", when: "", why: "", painPoints: "",
    alternatives: "", source: "manual", sourceUrl: "", tags: "", stage: "seed", category: "",
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-border shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm text-foreground">문제 카드 추가</h2>
          <button onClick={onClose}><X size={16} className="text-subtle" /></button>
        </div>
        <div className="p-5 space-y-3">
          {[
            ["title", "문제 제목 *", "text"],
            ["who", "누가 겪는가 *", "text"],
            ["when", "언제 겪는가", "text"],
            ["why", "왜 겪는가", "text"],
          ].map(([k, label]) => (
            <div key={k}>
              <label className="text-xs text-muted mb-1 block">{label}</label>
              <input
                value={(form as Record<string, string>)[k]}
                onChange={set(k)}
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          ))}
          {[
            ["painPoints", "불편함 / 비용"],
            ["alternatives", "현재 대체재"],
          ].map(([k, label]) => (
            <div key={k}>
              <label className="text-xs text-muted mb-1 block">{label}</label>
              <textarea
                value={(form as Record<string, string>)[k]}
                onChange={set(k)}
                rows={2}
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted mb-1 block">카테고리</label>
              <input value={form.category} onChange={set("category")} className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">태그 (콤마 구분)</label>
              <input value={form.tags} onChange={set("tags")} className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <button
            onClick={() => { if (form.title && form.who) { onSave(form); onClose(); } }}
            disabled={!form.title || !form.who}
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

const SCOUT_SOURCES = [
  { id: "producthunt", label: "Product Hunt" },
  { id: "appstore", label: "App Store" },
  { id: "news", label: "투자 뉴스" },
];

const SCOUT_TOPICS = [
  "건강/헬스케어", "생산성", "교육", "반려동물", "재무/핀테크",
  "커리어", "식품/음식", "여행", "B2B/SaaS", "개발자도구",
  "멘탈헬스", "환경/지속가능성", "쇼핑", "엔터테인먼트",
];

function buildScoutQuery(sources: string[], topics: string[], context: string): string {
  const srcLabel = sources.map(s =>
    s === "producthunt" ? "Product Hunt" :
    s === "appstore" ? "App Store 앱스토어" : "투자 뉴스"
  ).join(", ");
  const topicStr = topics.length > 0 ? topics.join(", ") + " 관련 " : "";
  const ctxStr = context.trim() ? ` (맥락: ${context.trim()})` : "";
  return `${srcLabel}에서 ${topicStr}문제 5개${ctxStr}`;
}

function ScoutModal({ onClose, onImport }: { onClose: () => void; onImport: (cards: Partial<ProblemCard>[]) => void }) {
  const [sources, setSources] = useState<Set<string>>(new Set(["producthunt"]));
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [context, setContext] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [parsed, setParsed] = useState<Partial<ProblemCard>[]>([]);
  const [parseError, setParseError] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggleSource(id: string) {
    setSources(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleTopic(t: string) {
    setTopics(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
  }

  const canRun = sources.size > 0 && !streaming;

  async function runScout() {
    if (!canRun) return;
    const query = buildScoutQuery([...sources], [...topics], context);
    setStreaming(true);
    setStage(null);
    setResult("");
    setParsed([]);
    setSelected(new Set());
    setParseError(false);
    const res = await fetch("/api/problems/scout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
      const stageMatches = text.match(/\|\|STAGE\|\|([^\n]+)/g);
      if (stageMatches?.length)
        setStage(stageMatches[stageMatches.length - 1].replace("||STAGE||", "").trim());
      setResult(text.replace(/\|\|STAGE\|\|[^\n]*\n?/g, ""));
    }
    setStage(null);
    setStreaming(false);
    const cleanText = text.replace(/\|\|STAGE\|\|[^\n]*\n?/g, "");
    try {
      const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const cards = JSON.parse(jsonMatch[0]);
        setParsed(cards);
        setSelected(new Set(cards.map((_: unknown, i: number) => i)));
      } else setParseError(true);
    } catch { setParseError(true); }
  }

  function toggleCard(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-border shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Telescope size={16} className="text-violet-600" />
            <h2 className="font-semibold text-sm text-foreground">Problem Scout Agent</h2>
          </div>
          <button onClick={onClose}><X size={16} className="text-subtle" /></button>
        </div>
        <div className="p-5 space-y-5">
          {/* 데이터 소스 */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">데이터 소스</p>
            <div className="flex gap-3">
              {SCOUT_SOURCES.map(s => (
                <label key={s.id} className={`flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2.5 text-sm transition-colors ${sources.has(s.id) ? "border-violet-400 bg-violet-50 text-violet-700" : "border-border text-secondary hover:bg-canvas"}`}>
                  <input type="checkbox" className="hidden" checked={sources.has(s.id)} onChange={() => toggleSource(s.id)} />
                  <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs font-bold shrink-0 ${sources.has(s.id) ? "bg-violet-600 border-violet-600 text-white" : "border-border-strong"}`}>
                    {sources.has(s.id) ? "✓" : ""}
                  </span>
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          {/* 관심 분야 */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">관심 분야 <span className="text-subtle font-normal">(복수 선택)</span></p>
            <div className="flex flex-wrap gap-2">
              {SCOUT_TOPICS.map(t => (
                <button
                  key={t}
                  onClick={() => toggleTopic(t)}
                  className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${topics.has(t) ? "bg-violet-600 border-violet-600 text-white" : "bg-wash border-transparent hover:bg-neutral-200 text-tertiary"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 맥락 */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">맥락 <span className="text-subtle font-normal">(선택)</span></p>
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runScout(); }}
              placeholder='예: "1인 창업자", "번아웃", "루틴 관리"'
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <button
            onClick={runScout}
            disabled={!canRun}
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
          >
            {streaming ? <><Loader2 size={14} className="animate-spin" />탐색 중...</> : "탐색"}
          </button>
          {streaming && (
            <div className="flex items-center gap-2 text-xs text-violet-600 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5">
              <Loader2 size={12} className="animate-spin shrink-0" />
              <span>{stage ?? "탐색 준비 중..."}</span>
            </div>
          )}
          {streaming && result && (
            <div className="text-xs text-muted bg-canvas border border-border rounded-lg p-3 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
              {result}
            </div>
          )}
          {parseError && !streaming && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              응답 파싱에 실패했습니다. 다시 시도해주세요.
            </div>
          )}
          {parsed.length > 0 && !streaming && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">{parsed.length}개 문제 발견 — 가져올 카드를 선택하세요</p>
                <button
                  onClick={() => setSelected(selected.size === parsed.length ? new Set() : new Set(parsed.map((_, i) => i)))}
                  className="text-xs text-violet-600 hover:text-violet-500"
                >
                  {selected.size === parsed.length ? "전체 해제" : "전체 선택"}
                </button>
              </div>
              {parsed.map((card, i) => (
                <button
                  key={i}
                  onClick={() => toggleCard(i)}
                  className={`w-full text-left rounded-lg border p-4 space-y-1 transition-colors ${
                    selected.has(i)
                      ? "border-violet-400 bg-violet-50"
                      : "border-border bg-canvas opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center text-xs font-bold transition-colors ${
                      selected.has(i) ? "bg-violet-600 border-violet-600 text-white" : "border-border-strong"
                    }`}>
                      {selected.has(i) ? "✓" : ""}
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{card.title}</p>
                      <p className="text-xs text-tertiary">{card.who}</p>
                      <p className="text-xs text-muted">{card.painPoints}</p>
                    </div>
                  </div>
                </button>
              ))}
              <button
                disabled={selected.size === 0}
                onClick={() => { onImport(parsed.filter((_, i) => selected.has(i))); onClose(); }}
                className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
              >
                선택 항목 가져오기 ({selected.size}개)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ card, onClose }: { card: ProblemCard; onClose: () => void }) {
  const fields = [
    { label: "누가 겪는가", value: card.who },
    { label: "언제 겪는가", value: card.when },
    { label: "왜 겪는가", value: card.why },
    { label: "불편함 & 비용", value: card.painPoints },
    { label: "현재 대체재", value: card.alternatives },
  ].filter((f) => f.value);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full md:max-w-md bg-surface border-l border-border shadow-xl z-50 flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="space-y-2 pr-4">
            <h2 className="font-semibold text-sm text-foreground leading-snug">{card.title}</h2>
            <div className="flex flex-wrap gap-1">
              {card.source !== "manual" && (
                <Badge variant="blue">{SOURCE_LABELS[card.source] ?? card.source}</Badge>
              )}
              {card.stage && <Badge variant="amber">{card.stage}</Badge>}
              {card.category && <Badge variant="default">{card.category}</Badge>}
              {card.fitEvaluations.length > 0 && (
                <span className="text-xs font-semibold text-violet-700 bg-violet-100 border border-violet-200 rounded-full px-2 py-0.5">
                  Fit {card.fitEvaluations[0].totalScore.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-subtle hover:text-secondary mt-0.5">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-xs font-medium text-muted mb-1">{f.label}</p>
              <p className="text-sm text-body leading-relaxed">{f.value}</p>
            </div>
          ))}

          {card.tags && (
            <div>
              <p className="text-xs font-medium text-muted mb-1.5">태그</p>
              <div className="flex flex-wrap gap-1.5">
                {card.tags.split(",").filter(Boolean).map((t) => (
                  <span key={t} className="text-xs bg-wash text-tertiary rounded px-2 py-1">
                    {t.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {card.sourceUrl && (
            <a
              href={card.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-500"
            >
              <ExternalLink size={13} />
              출처 보기
            </a>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0">
          <a
            href="/fit"
            className="flex items-center justify-center w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
          >
            Fit 평가하기
          </a>
        </div>
      </div>
    </>
  );
}

export default function ProblemsPage() {
  const [cards, setCards] = useState<ProblemCard[]>([]);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showScout, setShowScout] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ProblemCard | null>(null);

  const fetchCards = useCallback(async () => {
    const res = await fetch(`/api/problems${q ? `?q=${q}` : ""}`);
    setCards(await res.json());
  }, [q]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  useEffect(() => {
    fetch("/api/problems/seed", { method: "POST" }).then(() => fetchCards());
  }, [fetchCards]);

  async function saveCard(data: Partial<ProblemCard>) {
    await fetch("/api/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await fetchCards();
  }

  async function importCards(data: Partial<ProblemCard>[]) {
    for (const card of data) {
      await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...card, addedBy: "scout" }),
      });
    }
    await fetchCards();
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crosshair size={20} className="text-violet-600" />
          <h1 className="text-lg font-semibold text-foreground">Problem Universe</h1>
          <span className="text-sm text-muted">{cards.length}개 문제 카드</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowScout(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-secondary hover:bg-wash transition-colors"
          >
            <Telescope size={14} />
            Scout
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
          >
            <Plus size={14} />
            직접 추가
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="문제 검색..."
          className="w-full max-w-sm rounded-lg border border-border bg-surface pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.id} className="flex flex-col gap-3 hover:border-border-strong transition-colors cursor-pointer" onClick={() => setSelectedCard(card)}>
            <CardHeader className="mb-0">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm leading-snug">{card.title}</CardTitle>
                {card.fitEvaluations.length > 0 && (
                  <span className="shrink-0 text-xs font-semibold text-violet-700 bg-violet-100 border border-violet-200 rounded-full px-2 py-0.5">
                    Fit {card.fitEvaluations[0].totalScore.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {card.source !== "manual" && (
                  <Badge variant="blue">{SOURCE_LABELS[card.source] ?? card.source}</Badge>
                )}
                {card.stage && <Badge variant="amber">{card.stage}</Badge>}
                {card.category && <Badge variant="default">{card.category}</Badge>}
              </div>
            </CardHeader>

            <div className="space-y-2 text-xs text-body">
              <div><span className="text-muted mr-1">대상</span>{card.who}</div>
              <div><span className="text-muted mr-1">불편함</span>{card.painPoints}</div>
              <div><span className="text-muted mr-1">대체재</span>{card.alternatives}</div>
            </div>

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
              <div className="flex flex-wrap gap-1">
                {card.tags.split(",").filter(Boolean).map((t) => (
                  <span key={t} className="text-xs bg-wash text-tertiary rounded px-1.5 py-0.5">{t.trim()}</span>
                ))}
              </div>
              {card.sourceUrl && (
                <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-subtle hover:text-tertiary" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>

      {showAdd && <AddCardModal onClose={() => setShowAdd(false)} onSave={saveCard} />}
      {showScout && <ScoutModal onClose={() => setShowScout(false)} onImport={importCards} />}
      {selectedCard && <DetailPanel card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </div>
  );
}
