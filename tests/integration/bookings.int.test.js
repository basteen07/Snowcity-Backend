const request = require('supertest');
const app = require('../../app');

// These are placeholders. Once bookings routes and controllers are wired and a test DB is ready,
// remove .skip to run full integration tests.
describe.skip('Bookings API (integration)', () => {
  it('GET /bookings should require auth', async () => {
    const res = await request(app).get('/bookings');
    expect([401, 403]).toContain(res.statusCode);
  });

  it('POST /bookings should validate payload', async () => {
    const res = await request(app).post('/bookings').send({});
    expect([400, 401, 403, 422]).toContain(res.statusCode);
  });
});

// Quick sanity test to ensure app is bootable in CI
describe('App boot', () => {
  it('responds on /health', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
  });
});