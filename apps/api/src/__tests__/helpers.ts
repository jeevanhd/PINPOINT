import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';

export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wH+2w8AAAAASUVORK5CYII=',
  'base64',
);

export function testApp(): Express {
  return createApp();
}

export interface TestUser {
  token: string;
  id: string;
  auth: { Authorization: string };
}

export async function signup(app: Express, email: string, name = 'Test User'): Promise<TestUser> {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name, email, password: 'password123' })
    .expect(201);
  const token = res.body.token as string;
  return { token, id: res.body.user.id as string, auth: { Authorization: `Bearer ${token}` } };
}

export async function createTopicWithPoints(
  app: Express,
  user: TestUser,
  overrides: Partial<{ title: string; points: string[] }> = {},
): Promise<{ topicId: string; keyPointIds: number[] }> {
  const points =
    overrides.points ?? [
      'Chlorophyll absorbs light energy',
      'Water is split and oxygen is released',
      'Light reactions produce ATP and NADPH',
      'The Calvin cycle fixes carbon dioxide into glucose',
      'Glucose stores energy from sunlight',
      'Rate depends on light intensity and temperature',
    ];
  const res = await request(app)
    .post('/api/topics')
    .set(user.auth)
    .send({
      title: overrides.title ?? 'Photosynthesis',
      notes: 'Photosynthesis turns light into chemical energy.',
      source: 'manual',
      keyPoints: points.map((text) => ({ text })),
    })
    .expect(201);
  return {
    topicId: res.body.id as string,
    keyPointIds: (res.body.keyPoints as { id: number }[]).map((kp) => kp.id),
  };
}

export async function createPlace(app: Express, user: TestUser, name = 'Study desk'): Promise<string> {
  const res = await request(app)
    .post('/api/places')
    .set(user.auth)
    .field('name', name)
    .attach('file', PNG_1PX, 'desk.png')
    .expect(201);
  return res.body.id as string;
}
