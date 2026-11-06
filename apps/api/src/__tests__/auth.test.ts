import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { signup, testApp } from './helpers';

const app = testApp();

describe('signup and login', () => {
  it('signs up, hashes the password and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Meera', email: 'meera@example.com', password: 'password123' })
      .expect(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ name: 'Meera', email: 'meera@example.com', passMark: 70 });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('refuses a duplicate email', async () => {
    await signup(app, 'dupe@example.com');
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Dupe', email: 'dupe@example.com', password: 'password123' })
      .expect(409);
    expect(res.body.error.code).toBe('conflict');
  });

  it('rejects a weak password and a bad email', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Short', email: 'short@example.com', password: 'short' })
      .expect(422);
    await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Bad', email: 'not-an-email', password: 'password123' })
      .expect(422);
  });

  it('logs in with the right password only', async () => {
    await signup(app, 'login@example.com');
    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'password123' })
      .expect(200);
    expect(ok.body.token).toBeTypeOf('string');
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrong-password' })
      .expect(401);
    expect(bad.body.error.code).toBe('unauthorized');
  });

  it('guards /me behind a token', async () => {
    const user = await signup(app, 'me@example.com', 'Jeevan');
    const me = await request(app).get('/api/auth/me').set(user.auth).expect(200);
    expect(me.body.name).toBe('Jeevan');
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set({ Authorization: 'Bearer nonsense' }).expect(401);
  });
});
