import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';

describe('POST /auth/verify', () => {
  let verificationToken: string;

  beforeEach(async () => {
    // Create a test user first
    const userData = {
      email: 'verify-test@example.com',
      password: 'Password123!',
      first_name: 'John',
      last_name: 'Doe'
    };

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    // In a real implementation, we would get the verification token from the email
    // For testing purposes, we'll assume it's returned or we can generate it
    verificationToken = 'test-verification-token';
  });

  it('should verify email with valid token', async () => {
    const verifyData = {
      token: verificationToken
    };

    const response = await request(app)
      .post('/api/v1/auth/verify')
      .send(verifyData)
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('verified');
  });

  it('should return 400 for missing token', async () => {
    const verifyData = {};

    await request(app)
      .post('/api/v1/auth/verify')
      .send(verifyData)
      .expect(400);
  });

  it('should return 400 for empty token', async () => {
    const verifyData = {
      token: ''
    };

    await request(app)
      .post('/api/v1/auth/verify')
      .send(verifyData)
      .expect(400);
  });

  it('should return 400 for invalid token format', async () => {
    const verifyData = {
      token: 'invalid-token-format'
    };

    await request(app)
      .post('/api/v1/auth/verify')
      .send(verifyData)
      .expect(400);
  });

  it('should return 400 for expired token', async () => {
    const verifyData = {
      token: 'expired-token-123'
    };

    await request(app)
      .post('/api/v1/auth/verify')
      .send(verifyData)
      .expect(400);
  });

  it('should return 400 for already used token', async () => {
    const verifyData = {
      token: 'already-used-token'
    };

    await request(app)
      .post('/api/v1/auth/verify')
      .send(verifyData)
      .expect(400);
  });

  it('should return 400 for malformed request body', async () => {
    await request(app)
      .post('/api/v1/auth/verify')
      .send('invalid json')
      .expect(400);
  });
});