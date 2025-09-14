import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('POST /auth/login', () => {
  let userId: string;
  let userEmail: string;

  beforeAll(async () => {
    // Create a test user first
    const userData = {
      email: 'login-test@example.com',
      password: 'Password123!',
      first_name: 'John',
      last_name: 'Doe'
    };

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    userId = response.body.id;
    userEmail = userData.email;
  });

  it('should login successfully with valid credentials', async () => {
    const loginData = {
      email: userEmail,
      password: 'Password123!'
    };

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toHaveProperty('id', userId);
    expect(response.body.user).toHaveProperty('email', userEmail);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThan(0);
  });

  it('should return 401 for invalid email', async () => {
    const loginData = {
      email: 'nonexistent@example.com',
      password: 'Password123!'
    };

    await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(401);
  });

  it('should return 401 for invalid password', async () => {
    const loginData = {
      email: userEmail,
      password: 'WrongPassword!'
    };

    await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(401);
  });

  it('should return 401 for missing email', async () => {
    const loginData = {
      password: 'Password123!'
    };

    await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(401);
  });

  it('should return 401 for missing password', async () => {
    const loginData = {
      email: userEmail
    };

    await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(401);
  });

  it('should return 400 for empty request body', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({})
      .expect(400);
  });

  it('should return 403 for unverified user (if verification is required)', async () => {
    // Create an unverified user
    const userData = {
      email: 'unverified@example.com',
      password: 'Password123!',
      first_name: 'Jane',
      last_name: 'Doe'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    const loginData = {
      email: 'unverified@example.com',
      password: 'Password123!'
    };

    await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(403);
  });
});