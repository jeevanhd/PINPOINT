import { prisma } from '../lib/prisma';

export const unitRepository = {
  listForUser(userId: string) {
    return prisma.unit.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { topics: true } } },
    });
  },
  create(userId: string, title: string) {
    return prisma.unit.create({ data: { userId, title }, include: { _count: { select: { topics: true } } } });
  },
  findForUser(userId: string, id: string) {
    return prisma.unit.findFirst({ where: { id, userId } });
  },
  delete(userId: string, id: string) {
    return prisma.unit.deleteMany({ where: { id, userId } });
  },
};
