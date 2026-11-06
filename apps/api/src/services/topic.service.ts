import type {
  CreateTopicInput,
  TopicDto,
  TopicFileDto,
  UnitDto,
  UpdateTopicInput,
} from '@pinpoint/shared';
import { MAX_PAGES_PER_TOPIC } from '@pinpoint/shared';
import { badRequest, notFound, unprocessable } from '../lib/errors';
import { assertPageBudget, inspectFile } from '../lib/files';
import { getJob } from '../lib/jobStore';
import { enqueueExtraction } from '../queues/queues';
import { getStorage } from '../storage';
import { fileRepository } from '../repositories/file.repository';
import { topicRepository } from '../repositories/topic.repository';
import { unitRepository } from '../repositories/unit.repository';
import { assignKeyPointIds, readKeyPoints } from './keyPoints.service';
import { publishToUser } from '../realtime/publish';
import type { JobRecord } from '../lib/jobStore';
import type { Prisma, Topic, TopicFile, Unit } from '@prisma/client';

type TopicWithRelations = Topic & {
  unit: Unit | null;
  files: TopicFile[];
};

function toFileDto(file: TopicFile): TopicFileDto {
  return {
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    pageCount: file.pageCount,
    url: getStorage().url(file.storageKey),
    createdAt: file.createdAt.toISOString(),
  };
}

export function toTopicDto(topic: TopicWithRelations): TopicDto {
  return {
    id: topic.id,
    unitId: topic.unitId,
    unitTitle: topic.unit?.title ?? null,
    title: topic.title,
    notes: topic.notes,
    source: topic.source.toLowerCase() as TopicDto['source'],
    keyPoints: readKeyPoints(topic.keyPointsJson),
    files: topic.files.map(toFileDto),
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
  };
}

export const topicService = {
  async listUnits(userId: string): Promise<UnitDto[]> {
    const units = await unitRepository.listForUser(userId);
    return units.map((u) => ({
      id: u.id,
      title: u.title,
      topicCount: u._count.topics,
      createdAt: u.createdAt.toISOString(),
    }));
  },

  async createUnit(userId: string, title: string): Promise<UnitDto> {
    const unit = await unitRepository.create(userId, title);
    await publishToUser(userId, 'dashboard:updated', { reason: 'topic' });
    return {
      id: unit.id,
      title: unit.title,
      topicCount: unit._count.topics,
      createdAt: unit.createdAt.toISOString(),
    };
  },

  async listTopics(userId: string): Promise<TopicDto[]> {
    const topics = await topicRepository.listForUser(userId);
    return topics.map((t) =>
      toTopicDto({
        ...t,
        files: t.files,
        unit: t.unit,
      }),
    );
  },

  async getTopic(userId: string, id: string): Promise<TopicDto> {
    const topic = await topicRepository.findForUser(userId, id);
    if (!topic) throw notFound('That topic does not exist');
    return toTopicDto(topic);
  },

  async createTopic(userId: string, input: CreateTopicInput): Promise<TopicDto> {
    let unitId: string | null = null;
    if (input.unitId) {
      const unit = await unitRepository.findForUser(userId, input.unitId);
      if (!unit) throw notFound('That unit does not exist');
      unitId = unit.id;
    }
    const { keyPoints, seq } = assignKeyPointIds([], input.keyPoints, 0);
    const topic = await topicRepository.create(userId, {
      title: input.title,
      notes: input.notes,
      source: input.source === 'ai' ? 'AI' : input.source === 'uploaded' ? 'UPLOADED' : 'MANUAL',
      unitId,
      keyPointsJson: keyPoints as unknown as Prisma.InputJsonValue,
      keyPointSeq: seq,
    });
    await publishToUser(userId, 'dashboard:updated', { reason: 'topic' });
    return this.getTopic(userId, topic.id);
  },

  async updateTopic(userId: string, id: string, input: UpdateTopicInput): Promise<TopicDto> {
    const current = await topicRepository.findForUser(userId, id);
    if (!current) throw notFound('That topic does not exist');

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.unitId !== undefined) {
      if (input.unitId === null) {
        data.unitId = null;
      } else {
        const unit = await unitRepository.findForUser(userId, input.unitId);
        if (!unit) throw notFound('That unit does not exist');
        data.unitId = unit.id;
      }
    }
    if (input.keyPoints !== undefined) {
      const existing = readKeyPoints(current.keyPointsJson);
      const { keyPoints, seq } = assignKeyPointIds(existing, input.keyPoints, current.keyPointSeq);
      data.keyPointsJson = keyPoints as unknown as Prisma.InputJsonValue;
      data.keyPointSeq = seq;
      data.source = 'MANUAL';
    }
    if (Object.keys(data).length === 0) throw badRequest('Nothing to update');

    await topicRepository.update(userId, id, data);
    await publishToUser(userId, 'dashboard:updated', { reason: 'topic' });
    return this.getTopic(userId, id);
  },

  async deleteTopic(userId: string, id: string): Promise<void> {
    const result = await topicRepository.delete(userId, id);
    if (result.count === 0) throw notFound('That topic does not exist');
    await publishToUser(userId, 'dashboard:updated', { reason: 'topic' });
  },

  /** Validates, stores and enqueues one uploaded page. Returns 202 data. */
  async addFile(
    userId: string,
    topicId: string,
    upload: { buffer: Buffer; originalName: string },
  ): Promise<{ fileId: string; pageCount: number; status: 'queued' }> {
    const topic = await topicRepository.findForUser(userId, topicId);
    if (!topic) throw notFound('That topic does not exist');

    const inspected = await inspectFile(upload.buffer);
    const existingPages = await fileRepository.totalPages(userId, topicId);
    assertPageBudget(existingPages, inspected.pageCount, MAX_PAGES_PER_TOPIC);

    const stored = await getStorage().put({
      buffer: upload.buffer,
      mimeType: inspected.mimeType,
      extension: inspected.extension,
    });

    const file = await fileRepository.create({
      topicId,
      userId,
      storageKey: stored.key,
      originalName: upload.originalName.slice(0, 200),
      mimeType: inspected.mimeType,
      sizeBytes: upload.buffer.length,
      pageCount: inspected.pageCount,
    });

    await enqueueExtraction({
      fileId: file.id,
      topicId,
      userId,
      storageKey: stored.key,
      mimeType: inspected.mimeType,
      fileName: upload.originalName,
      pageCount: inspected.pageCount,
    });

    await publishToUser(userId, 'dashboard:updated', { reason: 'topic' });
    return { fileId: file.id, pageCount: inspected.pageCount, status: 'queued' };
  },

  async deleteFile(userId: string, topicId: string, fileId: string): Promise<void> {
    const file = await fileRepository.findForUser(userId, fileId);
    if (!file || file.topicId !== topicId) throw notFound('That file does not exist');
    await fileRepository.deleteForUser(userId, fileId);
    await getStorage().remove(file.storageKey).catch(() => undefined);
    await publishToUser(userId, 'dashboard:updated', { reason: 'topic' });
  },

  async jobStatus(userId: string, topicId: string, fileId: string): Promise<JobRecord> {
    const file = await fileRepository.findForUser(userId, fileId);
    if (!file || file.topicId !== topicId) throw notFound('That file does not exist');
    const job = await getJob(fileId);
    if (!job) throw notFound('No extraction job for that file yet');
    return job;
  },

  /** Key points the student must still fix, used by "Pin the gaps". */
  async gapsForTopic(userId: string, topicId: string) {
    const topic = await topicRepository.findForUser(userId, topicId);
    if (!topic) throw notFound('That topic does not exist');
    const keyPoints = readKeyPoints(topic.keyPointsJson);
    const latest = topic.explanations[0];
    if (!latest) return { topicId, keyPoints, gaps: [] as { id: number; text: string }[] };
    const result = latest.resultJson as { points?: { keyPointId: number; verdict: string }[] };
    const unmet = new Set(
      (result.points ?? []).filter((p) => p.verdict !== 'covered').map((p) => p.keyPointId),
    );
    const gaps = keyPoints.filter((kp) => unmet.has(kp.id));
    if (gaps.length === 0 && keyPoints.length > 0) {
      throw unprocessable('Nothing to pin yet. Every key point is already covered.');
    }
    return { topicId, keyPoints, gaps };
  },
};
