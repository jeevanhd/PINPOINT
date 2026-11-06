import { prisma } from '../lib/prisma';

export const placeRepository = {
  listForUser(userId: string) {
    return prisma.place.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { flags: true } } },
    });
  },
  findForUser(userId: string, id: string) {
    return prisma.place.findFirst({
      where: { id, userId },
      include: {
        flags: {
          orderBy: { createdAt: 'asc' },
          include: { topic: { select: { id: true, title: true, keyPointsJson: true } } },
        },
      },
    });
  },
  create(userId: string, name: string, imageKey: string) {
    return prisma.place.create({ data: { userId, name, imageKey } });
  },
  update(userId: string, id: string, name: string) {
    return prisma.place.updateMany({ where: { id, userId }, data: { name } });
  },
  delete(userId: string, id: string) {
    return prisma.place.deleteMany({ where: { id, userId } });
  },
  countForUser(userId: string) {
    return prisma.place.count({ where: { userId } });
  },
  /** Places the user owns that actually have flags to recall. */
  listRecollectable(userId: string) {
    return prisma.place.findMany({
      where: { userId, flags: { some: {} } },
      include: { _count: { select: { flags: true } } },
    });
  },
};
