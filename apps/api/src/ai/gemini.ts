import { z } from 'zod';
import type { Extraction, JudgeResult } from '@pinpoint/shared';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { cacheGet, cacheKey, cacheSet } from './cache';
import { EXTRACT_SYSTEM, JUDGE_SYSTEM, buildExtractPrompt, buildJudgePrompt } from './prompt';
import type { AiProvider, ExtractionInput, JudgeInput } from './provider';

const ExtractionSchema = z.object({
  title: z.string().trim().min(1).max(140),
  notes: z.string().trim().max(4000).default(''),
  keyPoints: z.array(z.string().trim().min(1).max(400)).min(3).max(12),
});

const JudgeSchema = z.object({
  points: z
    .array(
      z.object({
        keyPointId: z.number().int().min(0),
        verdict: z.enum(['covered', 'partial', 'incorrect', 'missing']),
        evidence: z.string().max(500).default(''),
        feedback: z.string().max(500).default(''),
      }),
    )
    .min(1),
  summary: z.string().max(600).default(''),
  gaps: z.array(z.number().int().min(0)).max(4).default([]),
});

export class AiUnavailableError extends Error {
  readonly detail?: unknown;

  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = 'AiUnavailableError';
    this.detail = detail;
  }
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

function stripFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini' as const;
  readonly live = true;

  private async call(system: string, parts: Part[]): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      env.GEMINI_MODEL,
    )}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new AiUnavailableError(`Gemini responded ${res.status}`, body.slice(0, 300));
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new AiUnavailableError('Gemini returned no text');
    return text;
  }

  /** JSON-only output, validated with zod, retried exactly once if malformed. */
  private async callJson<T>(system: string, parts: Part[], schema: z.ZodType<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = await this.call(system, parts);
        return schema.parse(JSON.parse(stripFences(text)));
      } catch (err) {
        lastError = err;
        logger.warn({ attempt: attempt + 1, err }, 'gemini output unusable, retrying once');
      }
    }
    throw new AiUnavailableError('Gemini output could not be validated', lastError);
  }

  async extract(input: ExtractionInput): Promise<Extraction> {
    const key = cacheKey(['extract', env.GEMINI_MODEL, input.buffer]);
    const cached = await cacheGet(key);
    if (cached) {
      return toExtraction(ExtractionSchema.parse(JSON.parse(cached)));
    }
    const parsed = await this.callJson(
      EXTRACT_SYSTEM,
      [
        { inline_data: { mime_type: input.mimeType, data: input.buffer.toString('base64') } },
        { text: buildExtractPrompt(input.pageCount) },
      ],
      ExtractionSchema,
    );
    await cacheSet(key, JSON.stringify(parsed));
    return toExtraction(parsed);
  }

  async judge(input: JudgeInput): Promise<JudgeResult> {
    const prompt = buildJudgePrompt(input);
    const key = cacheKey(['judge', env.GEMINI_MODEL, prompt]);
    const cached = await cacheGet(key);
    if (cached) return toJudgeResult(JudgeSchema.parse(JSON.parse(cached)));
    const parsed = await this.callJson(JUDGE_SYSTEM, [{ text: prompt }], JudgeSchema);
    await cacheSet(key, JSON.stringify(parsed));
    return toJudgeResult(parsed);
  }
}

type ParsedExtraction = { title: string; notes?: string; keyPoints: string[] };
type ParsedJudge = {
  points: {
    keyPointId: number;
    verdict: 'covered' | 'partial' | 'incorrect' | 'missing';
    evidence?: string;
    feedback?: string;
  }[];
  summary?: string;
  gaps?: number[];
};

function toExtraction(parsed: ParsedExtraction): Extraction {
  return {
    title: parsed.title,
    notes: parsed.notes ?? '',
    keyPoints: parsed.keyPoints.map((text) => ({ text })),
  };
}

function toJudgeResult(parsed: ParsedJudge): JudgeResult {
  return {
    points: parsed.points.map((point) => ({
      keyPointId: point.keyPointId,
      verdict: point.verdict,
      evidence: point.evidence ?? '',
      feedback: point.feedback ?? '',
    })),
    summary: parsed.summary ?? '',
    gaps: parsed.gaps ?? [],
  };
}
