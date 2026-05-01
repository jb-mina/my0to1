import { z } from "zod";

export const SELF_MAP_CATEGORIES = [
  "interests",
  "strengths",
  "aversions",
  "flow",
  "network",
  "other",
] as const;

export const tensionSchema = z.object({
  entryIdA: z.string().min(1),
  entryIdB: z.string().min(1),
  description: z.string().min(10),
});

export const gapSchema = z.object({
  category: z.enum(SELF_MAP_CATEGORIES),
  reason: z.string().min(10),
});

export const threadSchema = z.object({
  summary: z.string().min(10),
  relatedEntryIds: z.array(z.string()).max(5).default([]),
});

export const synthesizerOutputSchema = z.object({
  identityStatement: z.string().min(20).max(400),
  citedEntryIds: z.array(z.string()).min(1).max(8),
  tensions: z.array(tensionSchema).max(3).default([]),
  gaps: z.array(gapSchema).max(3).default([]),
  threadToResume: z.array(threadSchema).max(2).default([]),
});

export type SynthesizerTension = z.infer<typeof tensionSchema>;
export type SynthesizerGap = z.infer<typeof gapSchema>;
export type SynthesizerThread = z.infer<typeof threadSchema>;
export type SynthesizerOutput = z.infer<typeof synthesizerOutputSchema>;
