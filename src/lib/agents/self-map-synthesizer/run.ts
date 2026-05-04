import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserMessage, type SynthesizerInput } from "./prompt";
import { synthesizerOutputSchema, type SynthesizerOutput } from "./schema";

const client = new Anthropic();

export async function runSelfMapSynthesizer(input: SynthesizerInput): Promise<SynthesizerOutput> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    // 4096 was overflowing once entries grew enough that
    // entryTagsByEntryId (one Korean array per entry) bloated the JSON
    // mid-stream — closing braces dropped, leaving the regex fallback
    // to throw a raw SyntaxError. 8192 buys headroom for ~30+ entries.
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  // If the cap is hit, surface that explicitly instead of letting the
  // truncated body lead to a misleading "no JSON found" / SyntaxError.
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "Self Map Synthesizer: response truncated (max_tokens reached). Try again or trim entries.",
    );
  }

  const rawText = response.content[0].type === "text" ? response.content[0].text : "{}";
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        `Self Map Synthesizer: no JSON found in response. raw: ${rawText.slice(0, 500)}`,
      );
    }
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error(
        `Self Map Synthesizer: malformed JSON in response. raw: ${rawText.slice(0, 500)}`,
      );
    }
  }

  return synthesizerOutputSchema.parse(parsed);
}
