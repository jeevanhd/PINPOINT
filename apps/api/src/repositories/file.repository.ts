import { prisma } from '../lib/prisma';

export const fileRepository = {
  listForTopic(userId: string, topicId: string) {
    return prisma.topicFile.findMany({ where: { topicId, userId }, orderBy: { createdAt: 'asc' } });
  },
  findForUser(userId: string, id: string) {
    return prisma.topicFile.findFirst({ where: { id, userId } });
  },
  create(data: {
    topicId: string;
    userId: string;
    storageKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    pageCount: number;
  }) {
    return prisma.topicFile.create({ data });
  },
  deleteForUser(userId: string, id: string) {
    return prisma.topicFile.deleteMany({ where: { id, userId } });
  },
  async totalPages(userId: string, topicId: string): Promise<number> {
    const files = await prisma.topicFile.findMany({
      where: { topicId, userId },
      select: { pageCount: true },
    });
    return files.reduce((sum, f) => sum + f.pageCount, 0);
  },
};
