import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { PNG_1PX, createPlace, createTopicWithPoints, signup, testApp } from './helpers';

const app = testApp();

describe('user isolation', () => {
  it('never lets user B read or modify user A data', async () => {
    const a = await signup(app, 'a@example.com', 'Aarav');
    const b = await signup(app, 'b@example.com', 'Bina');

    const { topicId, keyPointIds } = await createTopicWithPoints(app, a);
    const placeId = await createPlace(app, a);
    const flag = await request(app)
      .post(`/api/places/${placeId}/flags`)
      .set(a.auth)
      .send({ xPct: 40, yPct: 60, label: 'Lamp = light', notes: '', topicId, keyPointId: keyPointIds[0] })
      .expect(201);
    const round = await request(app)
      .post('/api/recall/start')
      .set(a.auth)
      .send({ placeId, timePerFlagSec: 20 })
      .expect(201);
    const exam = await request(app)
      .post('/api/exams')
      .set(a.auth)
      .send({ title: 'Physics', examDate: '2030-01-01' })
      .expect(201);

    // B reads
    await request(app).get(`/api/topics/${topicId}`).set(b.auth).expect(404);
    await request(app).get(`/api/places/${placeId}`).set(b.auth).expect(404);
    await request(app).get(`/api/recall/${round.body.id}`).set(b.auth).expect(404);

    // B writes
    await request(app).patch(`/api/topics/${topicId}`).set(b.auth).send({ title: 'Hijacked' }).expect(404);
    await request(app)
      .post(`/api/topics/${topicId}/explain`)
      .set(b.auth)
      .send({
        transcript:
          'Chlorophyll absorbs light energy and water is split so oxygen is released, then ATP and NADPH are made.',
        durationSec: 60,
        timeLimitSec: 60,
      })
      .expect(404);
    await request(app).post(`/api/topics/${topicId}/files`).set(b.auth).attach('file', PNG_1PX, 'x.png').expect(404);
    await request(app).patch(`/api/flags/${flag.body.id}`).set(b.auth).send({ xPct: 1 }).expect(404);
    await request(app).delete(`/api/flags/${flag.body.id}`).set(b.auth).expect(404);
    await request(app).post(`/api/places/${placeId}/flags`).set(b.auth).send({ xPct: 1, yPct: 1, label: 'x' }).expect(404);
    await request(app)
      .post(`/api/recall/${round.body.id}/result`)
      .set(b.auth)
      .send({ flagId: flag.body.id, outcome: 'green', msTaken: 500 })
      .expect(404);
    await request(app).delete(`/api/exams/${exam.body.id}`).set(b.auth).expect(404);
    await request(app).delete(`/api/topics/${topicId}`).set(b.auth).expect(404);

    // B's dashboard is empty, A's is not
    const bDash = await request(app).get('/api/dashboard').set(b.auth).expect(200);
    expect(bDash.body.stats.topics).toBe(0);
    expect(bDash.body.looseTopics).toHaveLength(0);
    const aDash = await request(app).get('/api/dashboard').set(a.auth).expect(200);
    expect(aDash.body.stats.topics).toBe(1);

    // A still sees everything intact
    const stillThere = await request(app).get(`/api/topics/${topicId}`).set(a.auth).expect(200);
    expect(stillThere.body.title).toBe('Photosynthesis');
  });

  it('keeps recall rounds scoped to their owner', async () => {
    const a = await signup(app, 'owner@example.com');
    const b = await signup(app, 'other@example.com');
    const placeId = await createPlace(app, a);
    await request(app)
      .post(`/api/places/${placeId}/flags`)
      .set(a.auth)
      .send({ xPct: 10, yPct: 10, label: 'Note' })
      .expect(201);

    // B cannot start a round on A's place
    await request(app).post('/api/recall/start').set(b.auth).send({ placeId, timePerFlagSec: 20 }).expect(404);
    // B has no recollectable place of their own
    await request(app).post('/api/recall/start').set(b.auth).send({ timePerFlagSec: 20 }).expect(422);
  });
});
