import type {
  CreateExamInput,
  DashboardDto,
  ExamDto,
  TopicCardDto,
  TopicTaskDto,
  UnitGroupDto,
} from '@pinpoint/shared';
import { notFound } from '../lib/errors';
import { examRepository } from '../repositories/exam.repository';
import { explanationRepository } from '../repositories/explanation.repository';
import { flagRepository } from '../repositories/flag.repository';
import { placeRepository } from '../repositories/place.repository';
import { recallRepository } from '../repositories/recall.repository';
import { topicRepository } from '../repositories/topic.repository';
import { userRepository } from '../repositories/user.repository';
import { publishToUser } from '../realtime/publish';
import { readKeyPoints } from './keyPoints.service';
import { toUserDto } from './auth.service';
import type { Exam } from '@prisma/client';

const DAY_MS = 86_400_000;
/** Threshold at which a round counts as "mostly green" (FR-2.4). */
export const MOSTLY_GREEN = 60;

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysUntil(examDate: Date, now: Date = new Date()): number {
  return Math.round((startOfUtcDay(examDate) - startOfUtcDay(now)) / DAY_MS);
}

export function urgencyLevel(days: number): ExamDto['level'] {
  if (days < 0) return 'past';
  if (days <= 3) return 'red';
  if (days <= 7) return 'amber';
  return 'calm';
}

export function toExamDto(exam: Exam, now: Date = new Date()): ExamDto {
  const days = daysUntil(exam.examDate, now);
  return {
    id: exam.id,
    title: exam.title,
    subject: exam.subject,
    examDate: exam.examDate.toISOString().slice(0, 10),
    daysLeft: days,
    level: urgencyLevel(days),
  };
}

/** Mastery is a blend, not a score the AI produces. Documented in DECISIONS.md. */
export function computeMastery(input: {
  bestScore: number | null;
  recallGreenPct: number | null;
  pinned: boolean;
}): number {
  const explain = input.bestScore ?? 0;
  const recall = input.recallGreenPct ?? 0;
  const pin = input.pinned ? 100 : 0;
  return Math.round(0.4 * explain + 0.4 * recall + 0.2 * pin);
}

export function buildTasks(input: {
  hasMaterial: boolean;
  bestScore: number | null;
  passMark: number;
  pinned: boolean;
  recallGreenPct: number | null;
}): TopicTaskDto[] {
  return [
    { id: 'material', label: 'Add material', done: input.hasMaterial },
    {
      id: 'explain',
      label: `Explain it (${input.passMark}%+)`,
      done: (input.bestScore ?? -1) >= input.passMark,
    },
    { id: 'pin', label: 'Pin it', done: input.pinned },
    {
      id: 'recall',
      label: 'Recall it',
      done: (input.recallGreenPct ?? -1) >= MOSTLY_GREEN,
    },
  ];
}

export const dashboardService = {
  async get(userId: string): Promise<DashboardDto> {
    const [user, topics, places, exams, bestScores, linkedCounts, placeIdsByTopic, greenByPlace] =
      await Promise.all([
        userRepository.findById(userId),
        topicRepository.listForUser(userId),
        placeRepository.listForUser(userId),
        examRepository.listForUser(userId),
        explanationRepository.bestScores(userId),
        flagRepository.linkedCountByTopic(userId),
        flagRepository.placeIdsByTopic(userId),
        recallRepository.latestGreenByPlace(userId),
      ]);
    if (!user) throw notFound('Account not found');

    const passMark = user.passMark;
    const examDtos = exams.map((e) => toExamDto(e));
    const upcoming = examDtos.filter((e) => e.daysLeft >= 0);
    const nearest = upcoming[0] ?? null;

    const cards: TopicCardDto[] = topics.map((topic) => {
      const keyPoints = readKeyPoints(topic.keyPointsJson);
      const bestScore = bestScores.get(topic.id) ?? null;
      const lastScore = topic.explanations[0]?.score ?? null;
      const flagsLinked = linkedCounts.get(topic.id) ?? 0;
      const placeIds = placeIdsByTopic.get(topic.id) ?? new Set<string>();
      const greenValues = [...placeIds]
        .map((placeId) => greenByPlace.get(placeId))
        .filter((v): v is number => typeof v === 'number');
      const recallGreenPct = greenValues.length > 0 ? Math.max(...greenValues) : null;
      const hasMaterial = topic.files.length > 0 || keyPoints.length > 0;
      const tasks = buildTasks({
        hasMaterial,
        bestScore,
        passMark,
        pinned: flagsLinked > 0,
        recallGreenPct,
      });

      return {
        id: topic.id,
        title: topic.title,
        notes: topic.notes,
        source: topic.source.toLowerCase() as TopicCardDto['source'],
        unitId: topic.unitId,
        unitTitle: topic.unit?.title ?? null,
        keyPointCount: keyPoints.length,
        fileCount: topic.files.length,
        mastery: computeMastery({ bestScore, recallGreenPct, pinned: flagsLinked > 0 }),
        bestScore,
        lastScore,
        attempts: topic._count.explanations,
        flagsLinked,
        lastRecallGreenPct: recallGreenPct,
        tasks,
        tasksDone: tasks.filter((t) => t.done).length,
      };
    });

    const unitMap = new Map<string, UnitGroupDto>();
    for (const topic of topics) {
      if (!topic.unit) continue;
      const group = unitMap.get(topic.unit.id) ?? { id: topic.unit.id, title: topic.unit.title, topics: [] };
      const card = cards.find((c) => c.id === topic.id);
      if (card) group.topics.push(card);
      unitMap.set(topic.unit.id, group);
    }

    const firstName = user.name.split(/\s+/)[0] ?? user.name;

    return {
      greeting: `Hey ${firstName}`,
      user: toUserDto(user),
      daysLeft: nearest ? nearest.daysLeft : null,
      nearestExam: nearest,
      upcomingExams: upcoming.slice(0, 3),
      exams: examDtos,
      units: [...unitMap.values()],
      looseTopics: cards.filter((c) => !c.unitId),
      stats: {
        topics: cards.length,
        units: unitMap.size,
        places: places.length,
        flags: places.reduce((sum, p) => sum + (p._count?.flags ?? 0), 0),
        explanations: await explanationRepository.countForUser(userId),
      },
    };
  },

  async listExams(userId: string): Promise<ExamDto[]> {
    const exams = await examRepository.listForUser(userId);
    return exams.map((e) => toExamDto(e));
  },

  async createExam(userId: string, input: CreateExamInput): Promise<ExamDto> {
    const examDate = new Date(`${input.examDate}T00:00:00.000Z`);
    const exam = await examRepository.create(userId, {
      title: input.title,
      subject: input.subject ?? null,
      examDate,
    });
    await publishToUser(userId, 'dashboard:updated', { reason: 'exam' });
    return toExamDto(exam);
  },

  async deleteExam(userId: string, id: string): Promise<void> {
    const result = await examRepository.delete(userId, id);
    if (result.count === 0) throw notFound('That exam does not exist');
    await publishToUser(userId, 'dashboard:updated', { reason: 'exam' });
  },
};
