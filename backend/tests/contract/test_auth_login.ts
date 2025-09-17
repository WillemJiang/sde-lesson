import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';

// Declare test utilities to make them available in this file
declare const testUtils: {
  generateUniqueEmail: (prefix: string) => string;
  createTestUserWithToken: (userData: any) => Promise<{ user: any; token: string }>;
};

describe('POST /auth/login', () => {
  let userId: string;
  let userEmail: string;
  let userPassword: string;

  beforeEach(async () => {
    // Create a test user using test utilities to ensure unique email
    userEmail = testUtils.generateUniqueEmail('login-test');
    userPassword = 'Password123!';

    const userData = {
      email: userEmail,
      password: userPassword,
      first_name: 'John',
      last_name: 'Doe'
    };

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    userId = response.body.user.id;
  });

  it('should login successfully with valid credentials', async () => {
    const loginData = {
      email: userEmail,
      password: userPassword
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

  it('should return 400 for missing email', async () => {
    const loginData = {
      password: 'Password123!'
    };

    await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(400);
  });

  it('should return 400 for missing password', async () => {
    const loginData = {
      email: userEmail
    };

    await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(400);
  });

  it('should return 400 for empty request body', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({})
      .expect(400);
  });

  it('should allow login for unverified user (verification not required for login)', async () => {
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

    // Currently, verification is not required for login
    await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(200);
  });
});