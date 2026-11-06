import type {
  RecallRoundDto,
  RecallStatePayload,
  StartRecallInput,
  RecallResultInput,
} from '@pinpoint/shared';
import { conflict, notFound, unprocessable } from '../lib/errors';
import { placeRepository } from '../repositories/place.repository';
import { recallRepository } from '../repositories/recall.repository';
import { publishToUser } from '../realtime/publish';
import { getStorage } from '../storage';
import { toFlagDto } from './palace.service';
import type { Flag, Place, RecallRound, RecallResult } from '@prisma/client';

type RoundRow = RecallRound & {
  results: RecallResult[];
  place: Place & { flags: Flag[] };
};

function toRoundDto(round: RoundRow, hideAnswers: boolean): RecallRoundDto {
  const flags = hideAnswers
    ? round.place.flags.map((f) => ({
        id: f.id,
        placeId: f.placeId,
        xPct: f.xPct,
        yPct: f.yPct,
        label: '',
        notes: '',
        topicId: null,
        topicTitle: null,
        keyPointId: null,
        keyPointText: null,
        createdAt: f.createdAt.toISOString(),
      }))
    : round.place.flags.map((f) => toFlagDto(f));

  return {
    id: round.id,
    placeId: round.placeId,
    placeName: round.place.name,
    imageUrl: getStorage().url(round.place.imageKey),
    status: round.status.toLowerCase() as RecallRoundDto['status'],
    timePerFlagSec: round.timePerFlagSec,
    startedAt: round.startedAt.toISOString(),
    finishedAt: round.finishedAt ? round.finishedAt.toISOString() : null,
    results: round.results.map((r) => ({
      flagId: r.flagId,
      outcome: r.outcome.toLowerCase() as 'green' | 'red',
      msTaken: r.msTaken,
    })),
    flags,
  };
}

function counts(results: RecallResult[]): { greenCount: number; redCount: number } {
  const greenCount = results.filter((r) => r.outcome === 'GREEN').length;
  return { greenCount, redCount: results.length - greenCount };
}

export const recallService = {
  async start(userId: string, input: StartRecallInput): Promise<RecallRoundDto> {
    let placeId = input.placeId;
    if (placeId) {
      const place = await placeRepository.findForUser(userId, placeId);
      if (!place) throw notFound('That place does not exist');
      if (place.flags.length === 0) throw unprocessable('Add a flag to this place before recalling it');
    } else {
      const candidates = await placeRepository.listRecollectable(userId);
      if (candidates.length === 0) throw unprocessable('Add a place with flags first, then come back');
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (!pick) throw unprocessable('No place available');
      placeId = pick.id;
    }

    // Only one active round at a time keeps reconnect unambiguous.
    const active = await recallRepository.findActiveForUser(userId);
    if (active) await recallRepository.setStatus(active.id, userId, 'FINISHED');

    const round = await recallRepository.createRound({
      userId,
      placeId,
      timePerFlagSec: input.timePerFlagSec,
    });
    const full = await recallRepository.findRoundForUser(userId, round.id);
    if (!full) throw notFound('Round could not be created');

    await publishToUser(userId, 'recall:start', {
      roundId: full.id,
      placeId: full.placeId,
      flagCount: full.place.flags.length,
      timePerFlagSec: full.timePerFlagSec,
    });
    return toRoundDto(full, true);
  },

  async submitResult(
    userId: string,
    roundId: string,
    input: RecallResultInput,
  ): Promise<{ greenCount: number; redCount: number; finished: boolean }> {
    const round = await recallRepository.findRoundForUser(userId, roundId);
    if (!round) throw notFound('That round does not exist');
    if (round.status !== 'ACTIVE') throw conflict('That round is already finished');
    const flag = round.place.flags.find((f) => f.id === input.flagId);
    if (!flag) throw notFound('That flag is not part of this round');

    await recallRepository.upsertResult({
      roundId,
      flagId: input.flagId,
      userId,
      outcome: input.outcome === 'green' ? 'GREEN' : 'RED',
      msTaken: input.msTaken,
    });

    const results = await recallRepository.listResults(roundId);
    const { greenCount, redCount } = counts(results);
    await publishToUser(userId, 'recall:flagResult', {
      roundId,
      flagId: input.flagId,
      outcome: input.outcome,
      greenCount,
      redCount,
    });

    const finished = results.length >= round.place.flags.length;
    if (finished) {
      await recallRepository.setStatus(roundId, userId, 'FINISHED');
      await publishToUser(userId, 'recall:finished', {
        roundId,
        greenCount,
        redCount,
        total: results.length,
      });
      await publishToUser(userId, 'dashboard:updated', { reason: 'recall' });
    }
    return { greenCount, redCount, finished };
  },

  async finish(userId: string, roundId: string): Promise<RecallRoundDto> {
    const round = await recallRepository.findRoundForUser(userId, roundId);
    if (!round) throw notFound('That round does not exist');
    await recallRepository.setStatus(roundId, userId, 'FINISHED');
    const results = await recallRepository.listResults(roundId);
    const { greenCount, redCount } = counts(results);
    await publishToUser(userId, 'recall:finished', {
      roundId,
      greenCount,
      redCount,
      total: results.length,
    });
    await publishToUser(userId, 'dashboard:updated', { reason: 'recall' });
    const full = await recallRepository.findRoundForUser(userId, roundId);
    if (!full) throw notFound('That round does not exist');
    return toRoundDto(full, false);
  },

  async getRound(userId: string, roundId: string): Promise<RecallRoundDto> {
    const round = await recallRepository.findRoundForUser(userId, roundId);
    if (!round) throw notFound('That round does not exist');
    return toRoundDto(round, round.status === 'ACTIVE');
  },

  async state(userId: string, roundId: string): Promise<RecallStatePayload | null> {
    const round = await recallRepository.findRoundForUser(userId, roundId);
    if (!round) return null;
    return {
      roundId: round.id,
      status: round.status === 'ACTIVE' ? 'active' : 'finished',
      placeId: round.placeId,
      timePerFlagSec: round.timePerFlagSec,
      startedAt: round.startedAt.toISOString(),
      results: round.results.map((r) => ({
        flagId: r.flagId,
        outcome: r.outcome === 'GREEN' ? 'green' : 'red',
        msTaken: r.msTaken,
      })),
    };
  },
};
