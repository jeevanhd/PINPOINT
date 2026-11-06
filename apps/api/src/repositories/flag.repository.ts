import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const flagRepository = {
  create(data: Prisma.FlagUncheckedCreateInput) {
    return prisma.flag.create({ data });
  },
  findForUser(userId: string, id: string) {
    return prisma.flag.findFirst({ where: { id, userId } });
  },
  update(userId: string, id: string, data: Prisma.FlagUncheckedUpdateInput) {
    return prisma.flag.updateMany({ where: { id, userId }, data });
  },
  delete(userId: string, id: string) {
    return prisma.flag.deleteMany({ where: { id, userId } });
  },
  listForPlace(userId: string, placeId: string) {
    return prisma.flag.findMany({ where: { placeId, userId }, orderBy: { createdAt: 'asc' } });
  },
  countForUser(userId: string) {
    return prisma.flag.count({ where: { userId } });
  },
  /** Topic id -> place ids that hold at least one flag for it. */
  async placeIdsByTopic(userId: string): Promise<Map<string, Set<string>>> {
    const rows = await prisma.flag.findMany({
      where: { userId, topicId: { not: null } },
      select: { topicId: true, placeId: true },
    });
    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!row.topicId) continue;
      const set = map.get(row.topicId) ?? new Set<string>();
      set.add(row.placeId);
      map.set(row.topicId, set);
    }
    return map;
  },

  /** How many flags reference each topic, used by the dashboard "Pin it" task. */
  async linkedCountByTopic(userId: string): Promise<Map<string, number>> {
    const rows = await prisma.flag.groupBy({
      by: ['topicId'],
      where: { userId, topicId: { not: null } },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const row of rows) if (row.topicId) map.set(row.topicId, row._count._all);
    return map;
  },
};
