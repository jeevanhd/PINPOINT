import type { Prisma, TopicSource } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const topicRepository = {
  listForUser(userId: string) {
    return prisma.topic.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        unit: true,
        files: true,
        explanations: { orderBy: { createdAt: 'desc' }, take: 1, select: { score: true } },
        _count: { select: { explanations: true, flags: true } },
      },
    });
  },
  findForUser(userId: string, id: string) {
    return prisma.topic.findFirst({
      where: { id, userId },
      include: {
        unit: true,
        files: { orderBy: { createdAt: 'asc' } },
        explanations: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  },
  create(
    userId: string,
    data: {
      title: string;
      notes: string;
      source: TopicSource;
      unitId: string | null;
      keyPointsJson: Prisma.InputJsonValue;
      keyPointSeq: number;
    },
  ) {
    return prisma.topic.create({ data: { userId, ...data } });
  },
  update(userId: string, id: string, data: Prisma.TopicUpdateInput) {
    return prisma.topic.updateMany({ where: { id, userId }, data });
  },
  delete(userId: string, id: string) {
    return prisma.topic.deleteMany({ where: { id, userId } });
  },
  countForUser(userId: string) {
    return prisma.topic.count({ where: { userId } });
  },
};
