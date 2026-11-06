import type { ExplainInput, ExplanationDto, JudgeResult, PointVerdict } from '@pinpoint/shared';
import { MIN_TRANSCRIPT_WORDS, computeScore, countWords } from '@pinpoint/shared';
import { judgeExplanation } from '../ai';
import { logger } from '../config/logger';
import { notFound, unprocessable } from '../lib/errors';
import { explanationRepository } from '../repositories/explanation.repository';
import { topicRepository } from '../repositories/topic.repository';
import { userRepository } from '../repositories/user.repository';
import { publishToUser } from '../realtime/publish';
import { readKeyPoints } from './keyPoints.service';
import type { Explanation, Prisma } from '@prisma/client';

interface StoredResult {
  points?: PointVerdict[];
  summary?: string;
  gaps?: number[];
}

export function toExplanationDto(explanation: Explanation): ExplanationDto {
  const stored = (explanation.resultJson ?? {}) as StoredResult;
  return {
    id: explanation.id,
    topicId: explanation.topicId,
    transcript: explanation.transcript,
    score: explanation.score,
    passed: explanation.passed,
    summary: stored.summary ?? '',
    gaps: stored.gaps ?? [],
    points: stored.points ?? [],
    fallback: explanation.fallback,
    createdAt: explanation.createdAt.toISOString(),
  };
}

export const explainService = {
  async explain(userId: string, topicId: string, input: ExplainInput): Promise<ExplanationDto> {
    const topic = await topicRepository.findForUser(userId, topicId);
    if (!topic) throw notFound('That topic does not exist');

    const keyPoints = readKeyPoints(topic.keyPointsJson);
    if (keyPoints.length === 0) {
      throw unprocessable('Add material to this topic first, then explain it.');
    }
    const words = countWords(input.transcript);
    if (words < MIN_TRANSCRIPT_WORDS) {
      throw unprocessable(`Say a little more - at least ${MIN_TRANSCRIPT_WORDS} words.`, {
        words,
        minWords: MIN_TRANSCRIPT_WORDS,
      });
    }

    const user = await userRepository.findById(userId);
    const passMark = user?.passMark ?? 70;

    // A placeholder row is not created before judging: nothing half-written
    // should ever appear on the dashboard.
    const { result, fallback } = await judgeExplanation({
      topicTitle: topic.title,
      notes: topic.notes,
      keyPoints,
      transcript: input.transcript,
    });

    const breakdown = computeScore(
      result.points.map((p) => p.verdict),
      passMark,
    );

    const explanation = await explanationRepository.create({
      topicId,
      userId,
      transcript: input.transcript,
      score: breakdown.score,
      passed: breakdown.passed,
      resultJson: result as unknown as Prisma.InputJsonValue,
      fallback,
      durationSec: input.durationSec,
    });

    await publishToUser(userId, 'explain:analyzing', {
      topicId,
      explanationId: explanation.id,
    });
    await publishToUser(userId, 'explain:transcript', {
      topicId,
      explanationId: explanation.id,
      wordCount: words,
    });

    // Stream the gap map one key point at a time. Fire and forget: the REST
    // response already carries the whole result.
    void streamResults(userId, topicId, explanation.id, result, breakdown.score, breakdown.passed, fallback);

    await publishToUser(userId, 'dashboard:updated', { reason: 'explain' });
    return toExplanationDto(explanation);
  },

  async listForTopic(userId: string, topicId: string): Promise<ExplanationDto[]> {
    const topic = await topicRepository.findForUser(userId, topicId);
    if (!topic) throw notFound('That topic does not exist');
    const rows = await explanationRepository.listForTopic(userId, topicId);
    return rows.map(toExplanationDto);
  },
};

async function streamResults(
  userId: string,
  topicId: string,
  explanationId: string,
  result: JudgeResult,
  score: number,
  passed: boolean,
  fallback: boolean,
): Promise<void> {
  try {
    for (const point of result.points) {
      await publishToUser(userId, 'explain:result', {
        topicId,
        explanationId,
        final: false,
        point,
      });
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    await publishToUser(userId, 'explain:result', {
      topicId,
      explanationId,
      final: true,
      score,
      passed,
      summary: result.summary,
      gaps: result.gaps,
      fallback,
    });
  } catch (err) {
    logger.warn({ err, explanationId }, 'failed to stream explain result');
  }
}
