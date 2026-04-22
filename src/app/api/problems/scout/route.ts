import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM = `당신은 Problem Scout Agent입니다. 창업자가 탐색할 문제 카드를 발굴하는 리서처입니다.

역할:
- 제공된 실제 데이터(Product Hunt, App Store, 투자 뉴스 등)를 분석하여 창업자 관점의 문제를 식별합니다
- 각 문제를 창업자 관점에서 구조화합니다

사용자가 요청하면 다음 형식의 문제 카드를 JSON 배열로 반환하세요:
[
  {
    "title": "한 줄 문제 제목",
    "who": "누가 겪는가 (구체적인 페르소나)",
    "when": "언제 겪는가",
    "why": "왜 겪는가 (근본 원인)",
    "painPoints": "구체적인 불편함과 비용",
    "alternatives": "현재 대체재",
    "source": "yc | sequoia | a16z | producthunt | appstore | news | manual",
    "sourceUrl": "출처 URL",
    "tags": "태그1,태그2",
    "stage": "seed | series-a",
    "category": "카테고리명"
  }
]

중요:
- 실제 데이터가 제공된 경우: sourceUrl은 반드시 제공된 데이터에 있는 URL만 사용하세요.
- 실제 데이터가 없는 경우: sourceUrl은 빈 문자열("")로 두세요. URL을 추측하거나 생성하지 마세요.
- 투자 뉴스 데이터가 제공된 경우: source는 기사에서 파악 가능한 투자사 이름("yc"/"a16z"/"sequoia") 또는 "news".
- 투자 뉴스 sourceUrl: 반드시 기사 URL(url 필드)을 사용하세요. 스타트업 웹사이트 URL을 추측하거나 생성하지 마세요.
- 응답은 반드시 JSON 배열만 반환하세요. 설명 텍스트 없이.`;

const PH_TOPIC_MAP: Record<string, string> = {
  productivity: "productivity",
  생산성: "productivity",
  health: "health",
  healthcare: "health",
  헬스: "health",
  헬스케어: "health",
  developer: "developer-tools",
  "b2b": "developer-tools",
  개발자: "developer-tools",
  consumer: "consumer-tech",
  education: "education",
  교육: "education",
  finance: "finance",
  fintech: "finance",
  핀테크: "finance",
};

const VC_TOPIC_MAP: Record<string, string> = {
  건강: "healthcare", 헬스: "healthcare",
  생산성: "productivity", 교육: "education",
  재무: "fintech", 핀테크: "fintech",
  커리어: "career jobs", 식품: "food delivery", 여행: "travel",
  "b2b": "B2B SaaS enterprise", saas: "B2B SaaS enterprise",
  개발자: "developer tools devtools", 멘탈: "mental health wellness",
  반려동물: "pet care", 환경: "sustainability climate", 쇼핑: "ecommerce shopping",
  엔터테인먼트: "entertainment media",
};

async function fetchProductHuntPosts(query: string) {
  const lq = query.toLowerCase();
  const topic = Object.entries(PH_TOPIC_MAP).find(([k]) => lq.includes(k))?.[1];

  const gql = `{
    posts(first: 15, featured: true, order: VOTES${topic ? `, topic: "${topic}"` : ""}) {
      nodes {
        name
        tagline
        description
        url
        website
        votesCount
        createdAt
        topics { nodes { name } }
      }
    }
  }`;

  const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PRODUCT_HUNT_API_KEY}`,
    },
    body: JSON.stringify({ query: gql }),
  });
  const data = await res.json();
  return data.data?.posts?.nodes ?? [];
}

async function fetchAppStorePosts(count = 50) {
  const res = await fetch(
    `https://rss.marketingtools.apple.com/api/v2/kr/apps/top-free/${count}/apps.json`
  );
  const data = await res.json();
  return (data.feed?.results ?? []).map((a: { name: string; url: string; artistName: string; genres?: { name: string }[] }) => ({
    name: a.name,
    url: a.url,
    artistName: a.artistName,
    genre: a.genres?.[0]?.name ?? "",
  }));
}

async function fetchVCNews(query: string) {
  const lq = query.toLowerCase();
  const topicStr = [...new Set(
    Object.entries(VC_TOPIC_MAP)
      .filter(([k]) => lq.includes(k))
      .map(([, v]) => v)
  )].join(" ") || "startup";

  const searchQuery = topicStr !== "startup"
    ? `${topicStr} startup problem 2025 funded investment YC a16z sequoia`
    : `YC a16z sequoia startup 2025 investment problem customers solution`;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: searchQuery,
      search_depth: "basic",
      include_raw_content: true,
      max_results: 6,
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r: {
    title: string; url: string; content: string; raw_content?: string;
  }) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    raw_content: r.raw_content?.slice(0, 1500),
  }));
}

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  const q = query || "최근 Product Hunt featured 제품 중 흥미로운 문제 5개";
  const lq = q.toLowerCase();
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (s: string) => controller.enqueue(encoder.encode(s));
        try {
          let contextBlock = "";

          if (lq.includes("product hunt")) {
            send("||STAGE||데이터 수집 중\n");
            const posts = await fetchProductHuntPosts(q).catch(() => []);
            contextBlock += `[Product Hunt 데이터]\n${JSON.stringify(posts, null, 2)}\n\n`;
          }

          if (lq.includes("app store") || lq.includes("앱스토어")) {
            send("||STAGE||데이터 수집 중\n");
            const apps = await fetchAppStorePosts(50).catch(() => []);
            contextBlock += `[App Store 랭킹 데이터]\n${JSON.stringify(apps, null, 2)}\n\n`;
          }

          if (lq.includes("투자 뉴스")) {
            send("||STAGE||뉴스 검색 중\n");
            const news = await fetchVCNews(q).catch((e) => {
              console.error("[scout] Tavily failed:", e);
              return [];
            });
            send("||STAGE||스타트업 페이지 분석 중\n");
            if (news.length > 0)
              contextBlock += `[투자 뉴스 데이터]\n${JSON.stringify(news, null, 2)}\n\n`;
          }

          const userMessage = contextBlock
            ? `${contextBlock}위 실제 데이터를 기반으로 다음 요청을 처리하세요. 요청에 명시된 관심 분야와 무관한 내용은 건너뜁니다:\n${q}`
            : q;

          send("||STAGE||문제 카드 생성 중\n");

          const stream = client.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: SYSTEM,
            messages: [{ role: "user", content: userMessage }],
          });

          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              send(chunk.delta.text);
            }
          }
        } catch (e) {
          console.error("[scout]", e);
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
