/**
 * Domain primitives shared by the API, the worker and the web client.
 * Nothing here may import Prisma, Express or React.
 */

export const VERDICTS = ['covered', 'partial', 'incorrect', 'missing'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_WEIGHT: Record<Verdict, number> = {
  covered: 1,
  partial: 0.5,
  incorrect: 0,
  missing: 0,
};

export const DEFAULT_PASS_MARK = 70;
export const MIN_TRANSCRIPT_WORDS = 15;
export const MAX_PAGES_PER_TOPIC = 2;
export const KEY_POINTS_MIN = 5;
export const KEY_POINTS_MAX = 8;

export interface KeyPoint {
  /** Stable, server-assigned, never reused or renumbered. */
  id: number;
  text: string;
}

export interface KeyPointDraft {
  id?: number;
  text: string;
}

export interface Extraction {
  title: string;
  notes: string;
  keyPoints: { text: string }[];
}

export interface PointVerdict {
  keyPointId: number;
  verdict: Verdict;
  /** Short quote from the transcript that justifies the verdict. */
  evidence: string;
  /** One sentence of feedback for the student. */
  feedback: string;
}

export interface JudgeResult {
  points: PointVerdict[];
  summary: string;
  /** Key point ids that are the biggest gaps, 1-2 entries. */
  gaps: number[];
}

export interface ScoreBreakdown {
  score: number;
  covered: number;
  partial: number;
  total: number;
  passed: boolean;
  passMark: number;
}

/**
 * The score is never produced by the AI. This is the single implementation.
 * covered = 1, partial = 0.5, incorrect and missing = 0.
 */
export function computeScore(verdicts: Verdict[], passMark: number = DEFAULT_PASS_MARK): ScoreBreakdown {
  const total = verdicts.length;
  const sum = verdicts.reduce((acc, v) => acc + VERDICT_WEIGHT[v], 0);
  const covered = verdicts.filter((v) => v === 'covered').length;
  const partial = verdicts.filter((v) => v === 'partial').length;
  const score = total === 0 ? 0 : Math.round((sum / total) * 100);
  return { score, covered, partial, total, passed: score >= passMark, passMark };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isTranscriptLongEnough(text: string): boolean {
  return countWords(text) >= MIN_TRANSCRIPT_WORDS;
}

export type RecallOutcome = 'green' | 'red';
export type RecallStatus = 'active' | 'finished';
export type TopicSource = 'uploaded' | 'ai' | 'manual';

export const RECALL_TIME_OPTIONS = [10, 15, 20, 30, 45, 60] as const;
export const EXPLAIN_TIME_OPTIONS = [60, 120, 180, 300] as const;
