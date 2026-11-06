import type { KeyPoint, KeyPointDraft } from '@pinpoint/shared';

/** Prisma Json -> typed key points, tolerant of legacy/blank values. */
export function readKeyPoints(json: unknown): KeyPoint[] {
  if (!Array.isArray(json)) return [];
  const out: KeyPoint[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue;
    const id = (raw as { id?: unknown }).id;
    const text = (raw as { text?: unknown }).text;
    if (typeof id === 'number' && Number.isInteger(id) && typeof text === 'string' && text.trim()) {
      out.push({ id, text: text.trim() });
    }
  }
  return out;
}

/**
 * Ids are stable: an edited point keeps its id, a new point gets the next
 * value of a monotonic counter, and a deleted point's id is never handed out
 * again. Flags and explanation results keep pointing at the right idea.
 */
export function assignKeyPointIds(
  existing: KeyPoint[],
  incoming: KeyPointDraft[],
  currentSeq: number,
): { keyPoints: KeyPoint[]; seq: number } {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const used = new Set<number>();
  let seq = Math.max(currentSeq, ...existing.map((p) => p.id + 1), 0);

  const keyPoints = incoming.map((draft) => {
    const text = draft.text.trim();
    if (typeof draft.id === 'number' && byId.has(draft.id) && !used.has(draft.id)) {
      used.add(draft.id);
      return { id: draft.id, text };
    }
    const id = seq;
    seq += 1;
    used.add(id);
    return { id, text };
  });

  return { keyPoints, seq };
}

export function findKeyPoint(keyPoints: KeyPoint[], id: number): KeyPoint | undefined {
  return keyPoints.find((p) => p.id === id);
}
