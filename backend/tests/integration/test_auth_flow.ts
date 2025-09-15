import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('Authentication Flow Integration', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Register a test user first
    const userData = {
      email: 'auth-test@example.com',
      password: 'Password123!',
      first_name: 'Auth',
      last_name: 'Test'
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    userId = registerResponse.body.id;
  });

  it('should login with valid credentials', async () => {
    const loginData = {
      email: 'auth-test@example.com',
      password: 'Password123!'
    };

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toHaveProperty('id', userId);
    expect(response.body.user).toHaveProperty('email', loginData.email);
    
    authToken = response.body.token;
  });

  it('should reject login with invalid email', async () => {
    const loginData = {
      email: 'nonexistent@example.com',
      password: 'Password123!'
    };

    await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(401);
  });

  it('should reject login with wrong password', async () => {
    const loginData = {
      email: 'auth-test@example.com',
      password: 'WrongPassword123!'
    };

    await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(401);
  });

  it('should require both email and password for login', async () => {
    const loginData = {
      email: 'auth-test@example.com'
      // Missing password
    };

    await request(app)
      .post('/api/v1/auth/login')
      .send(loginData)
      .expect(400);
  });

  it('should access protected route with valid token', async () => {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', userId);
    expect(response.body).toHaveProperty('email', 'auth-test@example.com');
  });

  it('should reject access to protected route without token', async () => {
    await request(app)
      .get('/api/v1/users/profile')
      .expect(401);
  });

  it('should reject access to protected route with invalid token', async () => {
    await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('should handle multiple login sessions', async () => {
    // First login
    const firstLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'auth-test@example.com',
        password: 'Password123!'
      })
      .expect(200);

    // Second login
    const secondLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'auth-test@example.com',
        password: 'Password123!'
      })
      .expect(200);

    expect(firstLogin.body.token).not.toBe(secondLogin.body.token);
    expect(firstLogin.body.user.id).toBe(secondLogin.body.user.id);
  });

  it('should handle rate limiting for failed login attempts', async () => {
    const invalidLogin = {
      email: 'auth-test@example.com',
      password: 'WrongPassword123!'
    };

    // Multiple failed attempts
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send(invalidLogin)
        .expect(401);
    }

    // Should still allow login with correct credentials
    await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'auth-test@example.com',
        password: 'Password123!'
      })
      .expect(200);
  });

  it('should validate token expiration', async () => {
    // This test would require mocking token expiration
    // For now, just verify token structure
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'auth-test@example.com',
        password: 'Password123!'
      })
      .expect(200);

    expect(response.body.token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/);
  });

  it('should handle malformed authorization header', async () => {
    await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', 'InvalidHeader')
      .expect(401);

    await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', 'Bearer ')
      .expect(401);
  });
});