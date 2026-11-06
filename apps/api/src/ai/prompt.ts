import type { KeyPoint } from '@pinpoint/shared';

export const EXTRACT_SYSTEM = `You turn a student's study material into a compact study sheet.
Rules:
- Judge only what the uploaded pages say. Never add outside facts.
- Return JSON only. No markdown fences, no commentary.
- Key points must be the ideas a student must be able to explain aloud, not trivia.`;

export function buildExtractPrompt(pageCount: number): string {
  return `Read the attached study material (${pageCount} page${pageCount === 1 ? '' : 's'}).

Return exactly this JSON shape:
{
  "title": "short topic title, max 8 words",
  "notes": "2-4 sentence summary of the material in plain language",
  "keyPoints": ["5 to 8 short points, each one idea, max 25 words"]
}`;
}

export const JUDGE_SYSTEM = `You are a strict but encouraging examiner for a student who explained a topic aloud.
Rules:
- Judge only against the provided notes and key points. Never require outside knowledge.
- The transcript comes from browser speech recognition: ignore spelling, punctuation and homophone errors, and judge meaning. For example "sell" may be "cell" and "newton's second law" may arrive garbled.
- For each key point choose exactly one verdict: covered (the student stated the idea clearly), partial (right direction, incomplete or vague), incorrect (stated something contradictory), missing (never mentioned).
- "evidence" is a short quote from the transcript, or "" when nothing relevant was said.
- "feedback" is one sentence, concrete and kind, telling the student what to add or fix.
- "summary" is one sentence for the whole attempt.
- "gaps" lists the 1-2 key point ids that matter most to fix next.
- Return JSON only. No markdown fences.`;

export function buildJudgePrompt(input: {
  topicTitle: string;
  notes: string;
  keyPoints: KeyPoint[];
  transcript: string;
}): string {
  const points = input.keyPoints.map((p) => `${p.id}. ${p.text}`).join('\n');
  return `TOPIC: ${input.topicTitle}

NOTES (the only source of truth):
${input.notes || '(no notes supplied)'}

KEY POINTS (numbered by their stable ids):
${points}

STUDENT TRANSCRIPT (may contain speech-recognition errors):
"""
${input.transcript}
"""

Return exactly this JSON shape:
{
  "points": [
    { "keyPointId": 0, "verdict": "covered" | "partial" | "incorrect" | "missing", "evidence": "quote or empty", "feedback": "one sentence" }
  ],
  "summary": "one sentence",
  "gaps": [0]
}
Include one entry per key point id above, in the same order.`;
}
