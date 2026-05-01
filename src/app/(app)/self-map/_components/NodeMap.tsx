"use client";

import { useEffect, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import { ArrowRight, Loader2, X } from "lucide-react";

let coseRegistered = false;

export type GraphNode = {
  id: string;
  label: string;
  category: string;
  tags: string[];
};

export type GraphEdge = {
  source: string;
  target: string;
  sharedTags: string[];
  weight: number;
};

type GraphResponse = { nodes: GraphNode[]; edges: GraphEdge[] };

export type NodeMapEntry = {
  id: string;
  category: string;
  question: string;
  answer: string;
  tags: string;
};

const CATEGORY_COLOR: Record<string, string> = {
  interests: "#8b5cf6",
  strengths: "#10b981",
  aversions: "#ef4444",
  flow: "#f59e0b",
  network: "#3b82f6",
  other: "#a78bfa",
};

const CATEGORY_LABEL_KO: Record<string, string> = {
  interests: "관심사",
  strengths: "강점",
  aversions: "혐오",
  flow: "몰입 경험",
  network: "네트워크",
  other: "기타",
};

function colorFor(category: string): string {
  return CATEGORY_COLOR[category] ?? CATEGORY_COLOR.other;
}

function shortLabel(question: string): string {
  // 노드 옆 라벨은 8자까지만. 전체는 호버 footer + 클릭 시 detail 패널에서 노출.
  const trimmed = question.trim();
  return trimmed.length > 8 ? `${trimmed.slice(0, 8)}…` : trimmed;
}

export function NodeMap({
  refreshSignal,
  entries,
  onJumpToEntry,
}: {
  refreshSignal: string | number;
  entries: NodeMapEntry[];
  // Optional — when provided, the detail panel exposes "인터뷰에서 이 답변 보기"
  // which calls back so the page can flip to interview mode + scroll.
  onJumpToEntry?: (entryId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const hoveredEntry = hoveredNodeId ? entries.find((e) => e.id === hoveredNodeId) : null;
  const selectedEntry = selectedNodeId ? entries.find((e) => e.id === selectedNodeId) : null;

  // Fetch on mount + whenever refreshSignal flips.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch("/api/self-map/graph")
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return (await res.json()) as GraphResponse;
      })
      .then((data) => {
        if (!cancelled) setGraph(data);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  // Initialize / re-render cytoscape whenever graph data changes.
  useEffect(() => {
    if (!graph || !containerRef.current) return;

    if (!coseRegistered) {
      cytoscape.use(coseBilkent);
      coseRegistered = true;
    }

    cyRef.current?.destroy();

    const elements: ElementDefinition[] = [
      ...graph.nodes.map((n) => ({
        data: {
          id: n.id,
          label: shortLabel(n.label),
          fullLabel: n.label,
          category: n.category,
          tags: n.tags.join(", "),
        },
      })),
      ...graph.edges.map((e, i) => ({
        data: {
          id: `e${i}`,
          source: e.source,
          target: e.target,
          shared: e.sharedTags.join(", "),
          weight: e.weight,
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: cytoscape.NodeSingular) => colorFor(ele.data("category")),
            label: "data(label)",
            color: "#1f2937",
            "font-size": "10px",
            "text-valign": "bottom",
            "text-margin-y": 6,
            "text-wrap": "wrap",
            "text-max-width": "80px",
            width: 26,
            height: 26,
            "border-width": 2,
            "border-color": "#ffffff",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#7c3aed",
          },
        },
        {
          selector: "edge",
          style: {
            width: (ele: cytoscape.EdgeSingular) =>
              1 + Math.min(Number(ele.data("weight")) || 1, 4),
            "line-color": "#cbd5e1",
            "curve-style": "bezier",
            opacity: 0.5,
          },
        },
        {
          selector: "edge:hover",
          style: { "line-color": "#8b5cf6", opacity: 1 },
        },
      ],
      layout: {
        name: "cose-bilkent",
        animate: false,
        nodeRepulsion: 6500,
        idealEdgeLength: 100,
        edgeElasticity: 0.45,
        randomize: true,
        fit: true,
        padding: 30,
      } as cytoscape.LayoutOptions,
      wheelSensitivity: 0.2,
      minZoom: 0.3,
      maxZoom: 3,
    });

    cy.on("tap", "node", (evt) => {
      setSelectedNodeId(evt.target.id());
    });
    cy.on("tap", (evt) => {
      // Background click closes the detail panel.
      if (evt.target === cy) setSelectedNodeId(null);
    });
    cy.on("mouseover", "node", (evt) => {
      setHoveredNodeId(evt.target.id());
    });
    cy.on("mouseout", "node", () => {
      setHoveredNodeId(null);
    });

    cyRef.current = cy;

    // ResizeObserver — 컨테이너의 첫 nonzero 크기 도달 시 layout을 재실행해
    // 큰 캔버스 폭에 맞게 노드를 다시 펼친다. 단순 fit()만 하면 viewport zoom만
    // 변하고 노드 좌표는 좁은 mount 시점 기준에 갇혀 화면 한쪽에 몰린다.
    let pendingFrame = 0;
    let initialLayoutDone = false;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      const h = entries[0]?.contentRect.height ?? 0;
      if (w < 50 || h < 50) return;

      if (pendingFrame) cancelAnimationFrame(pendingFrame);
      pendingFrame = requestAnimationFrame(() => {
        cy.resize();
        if (!initialLayoutDone) {
          cy.layout({
            name: "cose-bilkent",
            animate: false,
            fit: true,
            randomize: false,
            idealEdgeLength: 100,
            nodeRepulsion: 6500,
            padding: 30,
          } as cytoscape.LayoutOptions).run();
          initialLayoutDone = true;
        } else {
          cy.fit(undefined, 30);
        }
      });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (pendingFrame) cancelAnimationFrame(pendingFrame);
      cy.destroy();
      if (cyRef.current === cy) cyRef.current = null;
    };
  }, [graph]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-canvas h-full min-h-64 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-violet-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 text-xs text-red-700">
        노드맵 로드 실패: {error}
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-canvas h-full min-h-64 flex items-center justify-center">
        <p className="text-xs text-subtle text-center px-4">
          대화하면 여기에 노드가 생겨요.
          <br />
          답변마다 한 노드, 공유 태그가 엣지로 연결됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-border bg-canvas overflow-hidden flex flex-col h-full min-h-0 w-full">
      <div ref={containerRef} className="w-full flex-1 min-h-0" />

      {selectedEntry && (
        <div className="absolute top-3 right-3 max-w-sm w-[min(22rem,calc(100%-1.5rem))] rounded-xl border border-border bg-surface shadow-lg z-10">
          <div className="flex items-start justify-between gap-2 px-4 pt-3">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: colorFor(selectedEntry.category) }}
              />
              <span className="text-[10px] font-medium text-tertiary">
                {CATEGORY_LABEL_KO[selectedEntry.category] ?? selectedEntry.category}
              </span>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="p-0.5 text-subtle hover:text-secondary rounded"
              aria-label="닫기"
            >
              <X size={14} />
            </button>
          </div>
          <div className="px-4 pb-3 pt-1.5">
            <p className="text-xs text-muted mb-1 leading-relaxed">{selectedEntry.question}</p>
            <p className="text-sm text-body leading-relaxed whitespace-pre-wrap">
              {selectedEntry.answer}
            </p>
            {selectedEntry.tags && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedEntry.tags
                  .split(",")
                  .filter(Boolean)
                  .map((t) => (
                    <span
                      key={t}
                      className="text-[10px] bg-wash text-tertiary rounded px-1.5 py-0.5"
                    >
                      {t.trim()}
                    </span>
                  ))}
              </div>
            )}
            {onJumpToEntry && (
              <button
                onClick={() => onJumpToEntry(selectedEntry.id)}
                className="mt-3 text-[11px] text-violet-600 hover:text-violet-700 inline-flex items-center gap-1"
              >
                인터뷰에서 이 답변 보기 <ArrowRight size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="shrink-0 px-3 py-2 border-t border-border text-[11px] text-subtle">
        {hoveredEntry ? (
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="shrink-0 inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: colorFor(hoveredEntry.category) }}
            />
            <span className="text-tertiary shrink-0">
              {CATEGORY_LABEL_KO[hoveredEntry.category] ?? hoveredEntry.category}
            </span>
            <span className="text-body truncate">{hoveredEntry.question}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span>노드 {graph.nodes.length} · 엣지 {graph.edges.length}</span>
            <span>호버: 전체 질문 · 클릭: 답변 상세</span>
          </div>
        )}
      </div>
    </div>
  );
}
