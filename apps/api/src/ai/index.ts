import type { JudgeResult } from '@pinpoint/shared';
import { aiEnabled } from '../config/env';
import { logger } from '../config/logger';
import { GeminiProvider } from './gemini';
import { keywordJudge } from './keywordFallback';
import { MockProvider } from './mock';
import type { AiProvider, JudgeInput } from './provider';

let provider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (!provider) {
    provider = aiEnabled ? new GeminiProvider() : new MockProvider();
    logger.info({ provider: provider.name, live: provider.live }, 'ai provider selected');
  }
  return provider;
}

/** Judge with the real provider, then degrade to the keyword matcher. */
export async function judgeExplanation(
  input: JudgeInput,
): Promise<{ result: JudgeResult; fallback: boolean }> {
  const ai = getAiProvider();
  try {
    const result = await ai.judge(input);
    return { result: normalise(result, input), fallback: false };
  } catch (err) {
    logger.warn({ err }, 'ai judge failed, using keyword fallback');
    return { result: normalise(keywordJudge(input), input), fallback: true };
  }
}

/** Guarantees one verdict per key point, in key point order. */
function normalise(result: JudgeResult, input: JudgeInput): JudgeResult {
  const byId = new Map(result.points.map((p) => [p.keyPointId, p]));
  const points = input.keyPoints.map((kp) => {
    const found = byId.get(kp.id);
    return (
      found ?? {
        keyPointId: kp.id,
        verdict: 'missing' as const,
        evidence: '',
        feedback: 'Not mentioned in this attempt.',
      }
    );
  });
  const gaps = result.gaps.filter((id) => input.keyPoints.some((kp) => kp.id === id)).slice(0, 2);
  return {
    points,
    summary: result.summary || 'Attempt recorded.',
    gaps: gaps.length > 0 ? gaps : points.filter((p) => p.verdict !== 'covered').slice(0, 2).map((p) => p.keyPointId),
  };
}

export type { AiProvider } from './provider';
