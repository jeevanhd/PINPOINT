import type { KeyPoint, PointVerdict, RecallOutcome, RecallStatus, TopicSource, Verdict } from './domain';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  passMark: number;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

export interface UnitDto {
  id: string;
  title: string;
  topicCount: number;
  createdAt: string;
}

export interface TopicFileDto {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  url: string;
  createdAt: string;
}

export interface TopicDto {
  id: string;
  unitId: string | null;
  unitTitle: string | null;
  title: string;
  notes: string;
  source: TopicSource;
  keyPoints: KeyPoint[];
  files: TopicFileDto[];
  createdAt: string;
  updatedAt: string;
}

export type TaskId = 'material' | 'explain' | 'pin' | 'recall';

export interface TopicTaskDto {
  id: TaskId;
  label: string;
  done: boolean;
}

export interface TopicCardDto {
  id: string;
  title: string;
  notes: string;
  source: TopicSource;
  unitId: string | null;
  unitTitle: string | null;
  keyPointCount: number;
  fileCount: number;
  mastery: number;
  bestScore: number | null;
  lastScore: number | null;
  attempts: number;
  flagsLinked: number;
  lastRecallGreenPct: number | null;
  tasks: TopicTaskDto[];
  tasksDone: number;
}

export interface UnitGroupDto {
  id: string;
  title: string;
  topics: TopicCardDto[];
}

export interface ExamDto {
  id: string;
  title: string;
  subject: string | null;
  examDate: string;
  daysLeft: number;
  level: 'past' | 'calm' | 'amber' | 'red';
}

export interface DashboardDto {
  greeting: string;
  user: UserDto;
  daysLeft: number | null;
  nearestExam: ExamDto | null;
  upcomingExams: ExamDto[];
  exams: ExamDto[];
  units: UnitGroupDto[];
  looseTopics: TopicCardDto[];
  stats: {
    topics: number;
    units: number;
    places: number;
    flags: number;
    explanations: number;
  };
}

export interface PlaceDto {
  id: string;
  name: string;
  imageUrl: string;
  flagCount: number;
  createdAt: string;
}

export interface FlagDto {
  id: string;
  placeId: string;
  xPct: number;
  yPct: number;
  label: string;
  notes: string;
  topicId: string | null;
  topicTitle: string | null;
  keyPointId: number | null;
  keyPointText: string | null;
  createdAt: string;
}

export interface PlaceDetailDto extends PlaceDto {
  flags: FlagDto[];
}

export interface ExplanationDto {
  id: string;
  topicId: string;
  transcript: string;
  score: number;
  passed: boolean;
  summary: string;
  gaps: number[];
  points: PointVerdict[];
  fallback: boolean;
  createdAt: string;
}

export interface RecallResultDto {
  flagId: string;
  outcome: RecallOutcome;
  msTaken: number;
}

export interface RecallRoundDto {
  id: string;
  placeId: string;
  placeName: string;
  imageUrl: string;
  status: RecallStatus;
  timePerFlagSec: number;
  startedAt: string;
  finishedAt: string | null;
  results: RecallResultDto[];
  flags: FlagDto[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface VerdictSummary {
  verdict: Verdict;
  keyPointId: number;
}
