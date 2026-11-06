import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const explanationRepository = {
  create(data: {
    topicId: string;
    userId: string;
    transcript: string;
    score: number;
    passed: boolean;
    resultJson: Prisma.InputJsonValue;
    fallback: boolean;
    durationSec: number;
  }) {
    return prisma.explanation.create({ data });
  },
  listForTopic(userId: string, topicId: string, take = 10) {
    return prisma.explanation.findMany({
      where: { topicId, userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },
  findForUser(userId: string, id: string) {
    return prisma.explanation.findFirst({ where: { id, userId } });
  },
  async bestScores(userId: string): Promise<Map<string, number>> {
    const rows = await prisma.explanation.groupBy({
      by: ['topicId'],
      where: { userId },
      _max: { score: true },
    });
    return new Map(rows.map((r) => [r.topicId, r._max.score ?? 0]));
  },
  countForUser(userId: string) {
    return prisma.explanation.count({ where: { userId } });
  },
};
