import { z } from "zod";

// RC personas + moderator output. Free-text fields (not JSON-mode); the
// schema exists for type safety on the route's response shape, not for
// model output validation. The Anthropic call is plain text per persona.
export const realityCheckOutputSchema = z.object({
  coldInvestor: z.string(),
  honestFriend: z.string(),
  socraticQ: z.string(),
  moderatorSummary: z.string(),
  inputContext: z.string(),
});

export type RealityCheckOutput = z.infer<typeof realityCheckOutputSchema>;
