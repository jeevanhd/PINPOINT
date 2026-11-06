import type { CreateFlagInput, FlagDto, PlaceDetailDto, PlaceDto, UpdateFlagInput } from '@pinpoint/shared';
import { notFound, unprocessable } from '../lib/errors';
import { inspectFile } from '../lib/files';
import { flagRepository } from '../repositories/flag.repository';
import { placeRepository } from '../repositories/place.repository';
import { topicRepository } from '../repositories/topic.repository';
import { publishToUser } from '../realtime/publish';
import { getStorage } from '../storage';
import { readKeyPoints } from './keyPoints.service';
import type { Flag, Place, Topic } from '@prisma/client';

type PlaceWithCount = Place & { _count?: { flags: number } };
type FlagWithTopic = Flag & { topic?: { id: string; title: string; keyPointsJson: unknown } | null };
type PlaceWithFlags = Place & { flags: FlagWithTopic[] };

function toPlaceDto(place: PlaceWithCount, flagCount: number): PlaceDto {
  return {
    id: place.id,
    name: place.name,
    imageUrl: getStorage().url(place.imageKey),
    flagCount,
    createdAt: place.createdAt.toISOString(),
  };
}

export function toFlagDto(flag: FlagWithTopic): FlagDto {
  const keyPoints = readKeyPoints(flag.topic?.keyPointsJson);
  const keyPoint = flag.keyPointId != null ? keyPoints.find((kp) => kp.id === flag.keyPointId) : undefined;
  return {
    id: flag.id,
    placeId: flag.placeId,
    xPct: flag.xPct,
    yPct: flag.yPct,
    label: flag.label,
    notes: flag.notes,
    topicId: flag.topicId,
    topicTitle: flag.topic?.title ?? null,
    keyPointId: flag.keyPointId,
    keyPointText: keyPoint?.text ?? null,
    createdAt: flag.createdAt.toISOString(),
  };
}

function toPlaceDetailDto(place: PlaceWithFlags): PlaceDetailDto {
  return {
    ...toPlaceDto(place, place.flags.length),
    flags: place.flags.map(toFlagDto),
  };
}

export const palaceService = {
  async listPlaces(userId: string): Promise<PlaceDto[]> {
    const places = await placeRepository.listForUser(userId);
    return places.map((p) => toPlaceDto(p, p._count?.flags ?? 0));
  },

  async createPlace(
    userId: string,
    name: string,
    upload: { buffer: Buffer; originalName: string },
  ): Promise<PlaceDto> {
    const inspected = await inspectFile(upload.buffer);
    if (inspected.mimeType === 'application/pdf') {
      throw unprocessable('A place needs a photo, not a PDF');
    }
    const stored = await getStorage().put({
      buffer: upload.buffer,
      mimeType: inspected.mimeType,
      extension: inspected.extension,
    });
    const place = await placeRepository.create(userId, name, stored.key);
    await publishToUser(userId, 'dashboard:updated', { reason: 'place' });
    return toPlaceDto(place, 0);
  },

  async getPlace(userId: string, id: string): Promise<PlaceDetailDto> {
    const place = await placeRepository.findForUser(userId, id);
    if (!place) throw notFound('That place does not exist');
    return toPlaceDetailDto(place);
  },

  async renamePlace(userId: string, id: string, name: string): Promise<PlaceDto> {
    const result = await placeRepository.update(userId, id, name);
    if (result.count === 0) throw notFound('That place does not exist');
    const place = await placeRepository.findForUser(userId, id);
    if (!place) throw notFound('That place does not exist');
    return toPlaceDto(place, place.flags.length);
  },

  async deletePlace(userId: string, id: string): Promise<void> {
    const place = await placeRepository.findForUser(userId, id);
    if (!place) throw notFound('That place does not exist');
    await placeRepository.delete(userId, id);
    await getStorage().remove(place.imageKey).catch(() => undefined);
    await publishToUser(userId, 'dashboard:updated', { reason: 'place' });
  },

  async createFlag(userId: string, placeId: string, input: CreateFlagInput): Promise<FlagDto> {
    const place = await placeRepository.findForUser(userId, placeId);
    if (!place) throw notFound('That place does not exist');
    await assertFlagLinks(userId, input.topicId, input.keyPointId);

    const flag = await flagRepository.create({
      placeId,
      userId,
      xPct: input.xPct,
      yPct: input.yPct,
      label: input.label,
      notes: input.notes,
      topicId: input.topicId ?? null,
      keyPointId: input.keyPointId ?? null,
    });
    await publishToUser(userId, 'dashboard:updated', { reason: 'flag' });
    return toFlagDto(await hydrateFlag(flag));
  },

  async updateFlag(userId: string, flagId: string, input: UpdateFlagInput): Promise<FlagDto> {
    const existing = await flagRepository.findForUser(userId, flagId);
    if (!existing) throw notFound('That flag does not exist');
    if (input.topicId !== undefined || input.keyPointId !== undefined) {
      await assertFlagLinks(userId, input.topicId ?? existing.topicId, input.keyPointId ?? existing.keyPointId);
    }
    await flagRepository.update(userId, flagId, {
      ...(input.xPct !== undefined ? { xPct: input.xPct } : {}),
      ...(input.yPct !== undefined ? { yPct: input.yPct } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.topicId !== undefined ? { topicId: input.topicId } : {}),
      ...(input.keyPointId !== undefined ? { keyPointId: input.keyPointId } : {}),
    });
    const updated = await flagRepository.findForUser(userId, flagId);
    if (!updated) throw notFound('That flag does not exist');
    await publishToUser(userId, 'dashboard:updated', { reason: 'flag' });
    return toFlagDto(await hydrateFlag(updated));
  },

  async deleteFlag(userId: string, flagId: string): Promise<void> {
    const result = await flagRepository.delete(userId, flagId);
    if (result.count === 0) throw notFound('That flag does not exist');
    await publishToUser(userId, 'dashboard:updated', { reason: 'flag' });
  },
};

async function assertFlagLinks(
  userId: string,
  topicId: string | null | undefined,
  keyPointId: number | null | undefined,
): Promise<void> {
  if (!topicId) {
    if (keyPointId != null) throw unprocessable('A key point needs its topic');
    return;
  }
  const topic = await topicRepository.findForUser(userId, topicId);
  if (!topic) throw notFound('That topic does not exist');
  if (keyPointId != null) {
    const keyPoints = readKeyPoints(topic.keyPointsJson);
    if (!keyPoints.some((kp) => kp.id === keyPointId)) {
      throw unprocessable('That key point is not part of this topic');
    }
  }
}

async function hydrateFlag(flag: Flag): Promise<FlagWithTopic> {
  if (!flag.topicId) return flag;
  const topic = await topicRepository.findForUser(flag.userId, flag.topicId);
  return {
    ...flag,
    topic: topic ? { id: topic.id, title: topic.title, keyPointsJson: topic.keyPointsJson } : null,
  } satisfies FlagWithTopic;
}

export type { Topic };
