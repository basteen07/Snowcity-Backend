const request = require('supertest');
const app = require('../../app');

describe('Health endpoint', () => {
  it('GET /health should return status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });
});

// Enable these after implementing user auth controllers and mounting routes in app.js
// and ensuring a test database is available.
describe.skip('Auth API (integration)', () => {
  it('POST /auth/register should validate payload', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'bad' });
    expect([400, 422]).toContain(res.statusCode);
  });

  it('POST /auth/login should reject invalid credentials', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'nobody@example.com',
      password: 'wrongpass',
    });
    // expect 401 or 404 depending on controller behavior
    expect([400, 401, 404]).toContain(res.statusCode);
  });
});