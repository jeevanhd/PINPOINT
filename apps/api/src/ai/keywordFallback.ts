import type { JudgeResult, KeyPoint, PointVerdict, Verdict } from '@pinpoint/shared';

const STOPWORDS = new Set([
  'the','a','an','of','and','or','to','in','is','are','was','were','that','this','it','as','for',
  'on','with','by','from','at','be','can','its','their','which','when','into','than','then','so',
  'also','not','but','if','has','have','had','will','would','may','might','more','most','such',
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function coverage(point: KeyPoint, transcriptTokens: Set<string>): number {
  const want = tokens(point.text);
  if (want.length === 0) return 0;
  const hit = want.filter((t) => transcriptTokens.has(t)).length;
  return hit / want.length;
}

function bestEvidence(point: KeyPoint, transcript: string): string {
  const want = new Set(tokens(point.text));
  let best = { score: 0, sentence: '' };
  for (const sentence of sentences(transcript)) {
    const have = tokens(sentence);
    if (have.length === 0) continue;
    const score = have.filter((t) => want.has(t)).length / Math.max(want.size, 1);
    if (score > best.score) best = { score, sentence };
  }
  return best.score >= 0.2 ? best.sentence.slice(0, 240) : '';
}

const FEEDBACK: Record<Verdict, (p: KeyPoint) => string> = {
  covered: () => 'Clear. Keep that wording, it is doing the work.',
  partial: (p) => `Right direction, but finish the thought about ${firstNoun(p.text)}.`,
  incorrect: () => 'That contradicts the material, re-read this part and say it again.',
  missing: (p) => `You never mentioned ${firstNoun(p.text)}. Add one sentence on it.`,
};

function firstNoun(text: string): string {
  const words = text.split(/\s+/).slice(0, 6).join(' ');
  return `“${words}${text.split(/\s+/).length > 6 ? '…' : ''}”`;
}

/**
 * Deterministic fallback used when Gemini is unavailable or returns malformed
 * JSON twice. It is intentionally simple: meaning-blind keyword overlap, with
 * the same verdict vocabulary and the same score rule.
 */
export function keywordJudge(input: {
  keyPoints: KeyPoint[];
  transcript: string;
}): JudgeResult {
  const transcriptTokens = new Set(tokens(input.transcript));
  const points: PointVerdict[] = input.keyPoints.map((point) => {
    const ratio = coverage(point, transcriptTokens);
    const verdict: Verdict = ratio >= 0.6 ? 'covered' : ratio >= 0.3 ? 'partial' : 'missing';
    return {
      keyPointId: point.id,
      verdict,
      evidence: bestEvidence(point, input.transcript),
      feedback: FEEDBACK[verdict](point),
    };
  });
  const gaps = points
    .filter((p) => p.verdict !== 'covered')
    .slice(0, 2)
    .map((p) => p.keyPointId);
  const covered = points.filter((p) => p.verdict === 'covered').length;
  return {
    points,
    summary:
      covered === points.length
        ? 'You covered every key point. Say it once more tomorrow and it will stick.'
        : `You explained ${covered} of ${points.length} key points clearly. Fix the gaps below and try again.`,
    gaps,
  };
}
