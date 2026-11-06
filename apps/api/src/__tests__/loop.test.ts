import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { createPlace, createTopicWithPoints, signup, testApp } from './helpers';

const app = testApp();

async function makePdf(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) {
    const page = doc.addPage([400, 500]);
    page.drawText(`Page ${i + 1}: photosynthesis notes`, { x: 40, y: 400, size: 14 });
  }
  return Buffer.from(await doc.save());
}

const TRANSCRIPT =
  'Chlorophyll absorbs light energy inside the chloroplast. Water is split and oxygen is released as a by-product. ' +
  'The light reactions produce ATP and NADPH which the Calvin cycle then uses.';

describe('the loop: upload -> explain -> pin -> recall', () => {
  it('runs end to end for one student', async () => {
    const user = await signup(app, 'loop@example.com', 'Jeevan');

    // --- Upload -------------------------------------------------------------
    const { topicId, keyPointIds } = await createTopicWithPoints(app, user);
    expect(keyPointIds).toEqual([0, 1, 2, 3, 4, 5]);

    const upload = await request(app)
      .post(`/api/topics/${topicId}/files`)
      .set(user.auth)
      .attach('file', await makePdf(2), 'notes.pdf')
      .expect(202);
    expect(upload.body).toMatchObject({ pageCount: 2, status: 'queued' });

    // The inline driver runs off the request path; poll the job record.
    let job: { stage: string; extraction?: { keyPoints: unknown[] } } | null = null;
    for (let i = 0; i < 40; i += 1) {
      const res = await request(app)
        .get(`/api/topics/${topicId}/files/${upload.body.fileId}/job`)
        .set(user.auth);
      if (res.status === 200) {
        job = res.body;
        if (job?.stage === 'done' || job?.stage === 'error') break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(job?.stage).toBe('done');
    expect(job?.extraction?.keyPoints.length).toBeGreaterThanOrEqual(5);

    // A third page is refused.
    await request(app)
      .post(`/api/topics/${topicId}/files`)
      .set(user.auth)
      .attach('file', await makePdf(1), 'more.pdf')
      .expect(422);

    // --- Explain ------------------------------------------------------------
    const explain = await request(app)
      .post(`/api/topics/${topicId}/explain`)
      .set(user.auth)
      .send({ transcript: TRANSCRIPT, durationSec: 95, timeLimitSec: 120 })
      .expect(201);
    expect(explain.body.points).toHaveLength(6);
    expect(explain.body.score).toBeGreaterThan(0);
    expect(explain.body.score).toBeLessThanOrEqual(100);
    expect(explain.body.transcript).toBe(TRANSCRIPT);

    // Score is computed in code from the verdicts, never trusted from the model.
    const weights: Record<string, number> = { covered: 1, partial: 0.5, incorrect: 0, missing: 0 };
    const expected = Math.round(
      (explain.body.points.reduce((sum: number, p: { verdict: string }) => sum + weights[p.verdict]!, 0) /
        explain.body.points.length) *
        100,
    );
    expect(explain.body.score).toBe(expected);

    const gaps = await request(app).get(`/api/topics/${topicId}/gaps`).set(user.auth).expect(200);
    expect(Array.isArray(gaps.body.gaps)).toBe(true);

    // A too-short transcript is blocked.
    await request(app)
      .post(`/api/topics/${topicId}/explain`)
      .set(user.auth)
      .send({ transcript: 'photosynthesis is light', durationSec: 10, timeLimitSec: 60 })
      .expect(422);

    // --- Pin ----------------------------------------------------------------
    const placeId = await createPlace(app, user);
    const linked = await request(app)
      .post(`/api/places/${placeId}/flags`)
      .set(user.auth)
      .send({ xPct: 30, yPct: 40, label: 'Lamp = light', notes: 'Chlorophyll', topicId, keyPointId: 0 })
      .expect(201);
    expect(linked.body).toMatchObject({ keyPointId: 0, topicTitle: 'Photosynthesis' });
    expect(linked.body.keyPointText).toBe('Chlorophyll absorbs light energy');

    // Dragging a flag saves percentages.
    const moved = await request(app)
      .patch(`/api/flags/${linked.body.id}`)
      .set(user.auth)
      .send({ xPct: 55.5, yPct: 61.25 })
      .expect(200);
    expect(moved.body).toMatchObject({ xPct: 55.5, yPct: 61.25 });

    // A flag cannot point at a key point from another topic.
    const other = await createTopicWithPoints(app, user, { title: 'Cell structure' });
    await request(app)
      .post(`/api/places/${placeId}/flags`)
      .set(user.auth)
      .send({ xPct: 1, yPct: 1, label: 'bad', topicId: other.topicId, keyPointId: 99 })
      .expect(422);

    // --- Recall -------------------------------------------------------------
    const round = await request(app)
      .post('/api/recall/start')
      .set(user.auth)
      .send({ placeId, timePerFlagSec: 20 })
      .expect(201);
    // Answers are hidden while the round is active.
    expect(round.body.flags[0].label).toBe('');
    expect(round.body.status).toBe('active');

    const first = await request(app)
      .post(`/api/recall/${round.body.id}/result`)
      .set(user.auth)
      .send({ flagId: linked.body.id, outcome: 'green', msTaken: 4200 })
      .expect(200);
    expect(first.body).toMatchObject({ greenCount: 1, redCount: 0, finished: true });

    const finished = await request(app).post(`/api/recall/${round.body.id}/finish`).set(user.auth).expect(200);
    expect(finished.body.status).toBe('finished');
    expect(finished.body.flags[0].label).toBe('Lamp = light');

    // --- Dashboard ----------------------------------------------------------
    const dash = await request(app).get('/api/dashboard').set(user.auth).expect(200);
    expect(dash.body.greeting).toBe('Hey Jeevan');
    const card = dash.body.looseTopics.find((t: { id: string }) => t.id === topicId);
    expect(card).toBeDefined();
    expect(card.fileCount).toBe(1);
    expect(card.flagsLinked).toBe(1);
    expect(card.lastRecallGreenPct).toBe(100);
    expect(card.mastery).toBeGreaterThan(0);
    const tasks = Object.fromEntries(card.tasks.map((t: { id: string; done: boolean }) => [t.id, t.done]));
    expect(tasks).toMatchObject({ material: true, pin: true, recall: true });
  });

  it('computes the exam countdown and urgency', async () => {
    const user = await signup(app, 'exam@example.com');
    const soon = new Date();
    soon.setUTCDate(soon.getUTCDate() + 2);
    await request(app)
      .post('/api/exams')
      .set(user.auth)
      .send({ title: 'Physics Unit 2', examDate: soon.toISOString().slice(0, 10), subject: 'Physics' })
      .expect(201);

    const dash = await request(app).get('/api/dashboard').set(user.auth).expect(200);
    expect(dash.body.daysLeft).toBe(2);
    expect(dash.body.nearestExam.level).toBe('red');
    expect(dash.body.upcomingExams).toHaveLength(1);
  });
});
