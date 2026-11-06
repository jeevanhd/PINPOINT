import { prisma } from '../lib/prisma';

export const examRepository = {
  listForUser(userId: string) {
    return prisma.exam.findMany({ where: { userId }, orderBy: { examDate: 'asc' } });
  },
  create(userId: string, data: { title: string; subject?: string | null; examDate: Date }) {
    return prisma.exam.create({ data: { userId, ...data } });
  },
  findForUser(userId: string, id: string) {
    return prisma.exam.findFirst({ where: { id, userId } });
  },
  delete(userId: string, id: string) {
    return prisma.exam.deleteMany({ where: { id, userId } });
  },
  countForUser(userId: string) {
    return prisma.exam.count({ where: { userId } });
  },
};
