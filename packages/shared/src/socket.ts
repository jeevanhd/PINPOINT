import { z } from 'zod';
import { VERDICTS } from './domain';

/**
 * Socket contract. Every payload is zod-validated on both ends.
 * No payload ever carries a user id: the authenticated handshake decides the
 * `user:{id}` room and the server derives the user from the socket.
 */

export const ServerEvents = {
  FileProcessing: 'file:processing',
  FileProgress: 'file:progress',
  FileDone: 'file:done',
  FileError: 'file:error',
  ExplainAnalyzing: 'explain:analyzing',
  ExplainTranscript: 'explain:transcript',
  ExplainResult: 'explain:result',
  RecallStart: 'recall:start',
  RecallFlagResult: 'recall:flagResult',
  RecallFinished: 'recall:finished',
  RecallState: 'recall:state',
  DashboardUpdated: 'dashboard:updated',
} as const;

export const ClientEvents = {
  RecallResume: 'recall:resume',
} as const;

export const fileProcessingSchema = z.object({
  topicId: z.string().min(1),
  fileId: z.string().min(1),
  stage: z.enum(['queued', 'reading', 'uploading', 'analyzing']),
});
export type FileProcessingPayload = z.infer<typeof fileProcessingSchema>;

export const fileProgressSchema = z.object({
  topicId: z.string().min(1),
  fileId: z.string().min(1),
  progress: z.number().min(0).max(100),
  stage: z.string().max(40),
});
export type FileProgressPayload = z.infer<typeof fileProgressSchema>;

export const extractedKeyPointSchema = z.object({ text: z.string().min(1).max(400) });

export const fileDoneSchema = z.object({
  topicId: z.string().min(1),
  fileId: z.string().min(1),
  extraction: z.object({
    title: z.string().min(1).max(140),
    notes: z.string().max(4000),
    keyPoints: z.array(extractedKeyPointSchema).min(1).max(12),
  }),
  pageCount: z.number().int().min(1).max(2),
});
export type FileDonePayload = z.infer<typeof fileDoneSchema>;

export const fileErrorSchema = z.object({
  topicId: z.string().min(1),
  fileId: z.string().min(1),
  code: z.enum(['too_many_pages', 'unsupported_type', 'too_large', 'ai_failed', 'unknown']),
  message: z.string().max(300),
});
export type FileErrorPayload = z.infer<typeof fileErrorSchema>;

export const explainAnalyzingSchema = z.object({
  topicId: z.string().min(1),
  explanationId: z.string().min(1),
});
export type ExplainAnalyzingPayload = z.infer<typeof explainAnalyzingSchema>;

export const explainTranscriptSchema = z.object({
  topicId: z.string().min(1),
  explanationId: z.string().min(1),
  wordCount: z.number().int().min(0),
});
export type ExplainTranscriptPayload = z.infer<typeof explainTranscriptSchema>;

export const explainResultSchema = z.object({
  topicId: z.string().min(1),
  explanationId: z.string().min(1),
  /** Streamed one key point at a time; the last event carries final: true. */
  final: z.boolean(),
  point: z
    .object({
      keyPointId: z.number().int().min(0),
      verdict: z.enum(VERDICTS),
      evidence: z.string().max(500),
      feedback: z.string().max(500),
    })
    .optional(),
  score: z.number().min(0).max(100).optional(),
  summary: z.string().max(600).optional(),
  gaps: z.array(z.number().int().min(0)).optional(),
  passed: z.boolean().optional(),
  fallback: z.boolean().optional(),
});
export type ExplainResultPayload = z.infer<typeof explainResultSchema>;

export const recallStartSchema = z.object({
  roundId: z.string().min(1),
  placeId: z.string().min(1),
  flagCount: z.number().int().min(1),
  timePerFlagSec: z.number().int().min(5).max(120),
});
export type RecallStartPayload = z.infer<typeof recallStartSchema>;

export const recallFlagResultSchema = z.object({
  roundId: z.string().min(1),
  flagId: z.string().min(1),
  outcome: z.enum(['green', 'red']),
  greenCount: z.number().int().min(0),
  redCount: z.number().int().min(0),
});
export type RecallFlagResultPayload = z.infer<typeof recallFlagResultSchema>;

export const recallFinishedSchema = z.object({
  roundId: z.string().min(1),
  greenCount: z.number().int().min(0),
  redCount: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type RecallFinishedPayload = z.infer<typeof recallFinishedSchema>;

export const recallStateSchema = z.object({
  roundId: z.string().min(1),
  status: z.enum(['active', 'finished']),
  placeId: z.string().min(1),
  timePerFlagSec: z.number().int(),
  startedAt: z.string(),
  results: z.array(
    z.object({
      flagId: z.string().min(1),
      outcome: z.enum(['green', 'red']),
      msTaken: z.number().int(),
    }),
  ),
});
export type RecallStatePayload = z.infer<typeof recallStateSchema>;

export const dashboardUpdatedSchema = z.object({
  reason: z.enum(['topic', 'explain', 'flag', 'recall', 'exam', 'place']),
});
export type DashboardUpdatedPayload = z.infer<typeof dashboardUpdatedSchema>;

/** Client -> server */
export const recallResumeSchema = z.object({ roundId: z.string().min(1) });
export type RecallResumePayload = z.infer<typeof recallResumeSchema>;

export const serverEventSchemas = {
  [ServerEvents.FileProcessing]: fileProcessingSchema,
  [ServerEvents.FileProgress]: fileProgressSchema,
  [ServerEvents.FileDone]: fileDoneSchema,
  [ServerEvents.FileError]: fileErrorSchema,
  [ServerEvents.ExplainAnalyzing]: explainAnalyzingSchema,
  [ServerEvents.ExplainTranscript]: explainTranscriptSchema,
  [ServerEvents.ExplainResult]: explainResultSchema,
  [ServerEvents.RecallStart]: recallStartSchema,
  [ServerEvents.RecallFlagResult]: recallFlagResultSchema,
  [ServerEvents.RecallFinished]: recallFinishedSchema,
  [ServerEvents.RecallState]: recallStateSchema,
  [ServerEvents.DashboardUpdated]: dashboardUpdatedSchema,
} as const;

export type ServerEventName = keyof typeof serverEventSchemas;

export interface ServerToClientEvents {
  'file:processing': (p: FileProcessingPayload) => void;
  'file:progress': (p: FileProgressPayload) => void;
  'file:done': (p: FileDonePayload) => void;
  'file:error': (p: FileErrorPayload) => void;
  'explain:analyzing': (p: ExplainAnalyzingPayload) => void;
  'explain:transcript': (p: ExplainTranscriptPayload) => void;
  'explain:result': (p: ExplainResultPayload) => void;
  'recall:start': (p: RecallStartPayload) => void;
  'recall:flagResult': (p: RecallFlagResultPayload) => void;
  'recall:finished': (p: RecallFinishedPayload) => void;
  'recall:state': (p: RecallStatePayload) => void;
  'dashboard:updated': (p: DashboardUpdatedPayload) => void;
}

export interface ClientToServerEvents {
  'recall:resume': (p: RecallResumePayload, ack?: (state: RecallStatePayload | null) => void) => void;
}
