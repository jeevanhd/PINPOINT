import type { FlagOutcome, RecallStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const recallRepository = {
  createRound(data: { userId: string; placeId: string; timePerFlagSec: number }) {
    return prisma.recallRound.create({ data });
  },
  findRoundForUser(userId: string, id: string) {
    return prisma.recallRound.findFirst({
      where: { id, userId },
      include: { results: true, place: { include: { flags: { orderBy: { createdAt: 'asc' } } } } },
    });
  },
  findActiveForUser(userId: string) {
    return prisma.recallRound.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
      include: { results: true, place: true },
    });
  },
  upsertResult(data: { roundId: string; flagId: string; userId: string; outcome: FlagOutcome; msTaken: number }) {
    return prisma.recallResult.upsert({
      where: { roundId_flagId: { roundId: data.roundId, flagId: data.flagId } },
      create: data,
      update: { outcome: data.outcome, msTaken: data.msTaken },
    });
  },
  setStatus(id: string, userId: string, status: RecallStatus) {
    return prisma.recallRound.updateMany({
      where: { id, userId },
      data: { status, ...(status === 'FINISHED' ? { finishedAt: new Date() } : {}) },
    });
  },
  listResults(roundId: string) {
    return prisma.recallResult.findMany({ where: { roundId }, orderBy: { createdAt: 'asc' } });
  },
  /** Green ratio of the most recent finished round per place, for the dashboard. */
  async latestGreenByPlace(userId: string): Promise<Map<string, number>> {
    const rounds = await prisma.recallRound.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: { results: true },
    });
    const map = new Map<string, number>();
    for (const round of rounds) {
      if (map.has(round.placeId) || round.results.length === 0) continue;
      const green = round.results.filter((r) => r.outcome === 'GREEN').length;
      map.set(round.placeId, Math.round((green / round.results.length) * 100));
    }
    return map;
  },
  async placeIdsWithRounds(userId: string): Promise<Set<string>> {
    const rows = await prisma.recallRound.findMany({ where: { userId }, select: { placeId: true } });
    return new Set(rows.map((r) => r.placeId));
  },
};
