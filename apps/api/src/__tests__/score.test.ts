import { describe, expect, it } from 'vitest';
import { computeScore, countWords, isTranscriptLongEnough } from '@pinpoint/shared';

describe('score computation', () => {
  it('weights covered 1, partial 0.5, incorrect and missing 0', () => {
    const result = computeScore(['covered', 'covered', 'partial', 'incorrect', 'missing']);
    // (1 + 1 + 0.5 + 0 + 0) / 5 = 0.5
    expect(result.score).toBe(50);
    expect(result.covered).toBe(2);
    expect(result.partial).toBe(1);
    expect(result.total).toBe(5);
  });

  it('never lets the AI decide the number', () => {
    expect(computeScore(['covered']).score).toBe(100);
    expect(computeScore(['missing', 'missing']).score).toBe(0);
    expect(computeScore([]).score).toBe(0);
  });

  it('rounds to the nearest whole percent', () => {
    // 2 of 3 covered = 66.66 -> 67
    expect(computeScore(['covered', 'covered', 'missing']).score).toBe(67);
    // 1 covered + 1 partial of 3 = 1.5/3 = 50
    expect(computeScore(['covered', 'partial', 'missing']).score).toBe(50);
  });

  it('applies the pass mark', () => {
    expect(computeScore(['covered', 'covered', 'partial', 'missing'], 70)).toMatchObject({
      score: 63,
      passed: false,
    });
    expect(computeScore(['covered', 'covered', 'covered', 'missing'], 70)).toMatchObject({
      score: 75,
      passed: true,
    });
  });

  it('blocks a too-short transcript', () => {
    expect(countWords('  explain   it  ')).toBe(2);
    expect(isTranscriptLongEnough('too short to count')).toBe(false);
    expect(isTranscriptLongEnough('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen')).toBe(true);
  });
});
