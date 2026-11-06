import type { Extraction, JudgeResult, KeyPoint } from '@pinpoint/shared';

export interface ExtractionInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  pageCount: number;
}

export interface JudgeInput {
  topicTitle: string;
  notes: string;
  keyPoints: KeyPoint[];
  transcript: string;
}

export interface AiProvider {
  readonly name: 'gemini' | 'mock';
  readonly live: boolean;
  extract(input: ExtractionInput): Promise<Extraction>;
  judge(input: JudgeInput): Promise<JudgeResult>;
}
