import { z } from 'zod';
import { EXPLAIN_TIME_OPTIONS, RECALL_TIME_OPTIONS, VERDICTS } from './domain';

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);

export const signupSchema = z.object({
  name: text(60),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateMeSchema = z
  .object({
    name: text(60).optional(),
    passMark: z.number().int().min(50).max(100).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const createUnitSchema = z.object({ title: text(120) });
export type CreateUnitInput = z.infer<typeof createUnitSchema>;

export const keyPointInputSchema = z.object({
  id: z.number().int().min(0).optional(),
  text: text(400),
});

export const createTopicSchema = z.object({
  unitId: id.nullish(),
  title: text(140),
  notes: z.string().max(4000).default(''),
  source: z.enum(['uploaded', 'ai', 'manual']).default('manual'),
  keyPoints: z.array(keyPointInputSchema).max(12).default([]),
});
export type CreateTopicInput = z.infer<typeof createTopicSchema>;

export const updateTopicSchema = z
  .object({
    title: text(140).optional(),
    notes: z.string().max(4000).optional(),
    unitId: id.nullish(),
    keyPoints: z.array(keyPointInputSchema).max(12).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;

export const explainInputSchema = z.object({
  transcript: z.string().trim().min(1).max(20000),
  durationSec: z.number().int().min(0).max(3600),
  timeLimitSec: z.union([z.literal(60), z.literal(120), z.literal(180), z.literal(300)]),
});
export type ExplainInput = z.infer<typeof explainInputSchema>;

export const createPlaceSchema = z.object({ name: text(80) });
export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;

export const updatePlaceSchema = z.object({ name: text(80) });

export const createFlagSchema = z.object({
  xPct: z.number().min(0).max(100),
  yPct: z.number().min(0).max(100),
  label: text(120),
  notes: z.string().max(1000).default(''),
  topicId: id.nullish(),
  keyPointId: z.number().int().min(0).nullish(),
});
export type CreateFlagInput = z.infer<typeof createFlagSchema>;

export const updateFlagSchema = z
  .object({
    xPct: z.number().min(0).max(100).optional(),
    yPct: z.number().min(0).max(100).optional(),
    label: text(120).optional(),
    notes: z.string().max(1000).optional(),
    topicId: id.nullish(),
    keyPointId: z.number().int().min(0).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type UpdateFlagInput = z.infer<typeof updateFlagSchema>;

export const startRecallSchema = z.object({
  placeId: id.optional(),
  timePerFlagSec: z
    .number()
    .int()
    .refine((v) => (RECALL_TIME_OPTIONS as readonly number[]).includes(v), {
      message: 'Unsupported time limit',
    }),
});
export type StartRecallInput = z.infer<typeof startRecallSchema>;

export const recallResultSchema = z.object({
  flagId: id,
  outcome: z.enum(['green', 'red']),
  msTaken: z.number().int().min(0).max(3_600_000),
});
export type RecallResultInput = z.infer<typeof recallResultSchema>;

export const createExamSchema = z.object({
  title: text(120),
  /** Calendar date in YYYY-MM-DD, stored as UTC midnight. */
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  subject: z.string().max(60).optional(),
});
export type CreateExamInput = z.infer<typeof createExamSchema>;

export const roundIdParamSchema = z.object({ roundId: id });
export const topicIdParamSchema = z.object({ id });
export const placeIdParamSchema = z.object({ id });
export const flagIdParamSchema = z.object({ id });

export const verdictSchema = z.enum(VERDICTS);
export const explainTimeOptions = EXPLAIN_TIME_OPTIONS;
