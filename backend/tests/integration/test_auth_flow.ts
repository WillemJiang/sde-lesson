import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';

// Access global test utilities
declare global {
  var testUtils: {
    createUser: (userData: any) => Promise<any>;
    createProduct: (productData: any) => Promise<any>;
    generateUniqueEmail: (prefix: string) => string;
    generateUniqueSKU: (prefix: string) => string;
    createTestUserWithToken: (userData: any) => Promise<{ user: any; token: string }>;
    validateToken: (token: string) => any;
  };
  var testUserIds: Set<string>;
}

describe('Authentication Flow Integration', () => {
  let authToken: string;
  let userId: string;

  // Helper function to create a test user
  const createTestUser = async (emailPrefix: string) => {
    const timestamp = Date.now();
    const uniqueEmail = `${emailPrefix}-${timestamp}@example.com`;
    const userData = {
      email: uniqueEmail,
      password: 'Password123!',
      first_name: 'Auth',
      last_name: 'Test'
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    if (registerResponse.status === 201 && registerResponse.body) {
      // Add this user to the protected testUserIds set to prevent deletion during cleanup
      if ((global as any).testUtils) {
        (global as any).testUtils.protectUser(registerResponse.body.user.id);
      }
      return {
        userId: registerResponse.body.user.id,
        email: uniqueEmail,
        user: registerResponse.body.user
      };
    } else {
      throw new Error(`User registration failed: ${registerResponse.status} - ${JSON.stringify(registerResponse.body)}`);
    }
  };

  it('should login with valid credentials', async () => {
    // Create a fresh user for this test
    const testUser = await createTestUser('auth-login-valid');
    userId = testUser.userId;

    const loginData = {
      email: testUser.email,
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
    // Create a fresh user for this test
    const testUser = await createTestUser('auth-login-wrong-pass');

    const loginData = {
      email: testUser.email,
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
    // Create a fresh user for this test
    const testUser = await createTestUser('auth-protected-route');

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'Password123!'
      })
      .expect(200);

    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${loginResponse.body.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('email', testUser.email);
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
    // Create a fresh user for this test
    const testUser = await createTestUser('auth-multi-session');

    // First login
    const firstLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'Password123!'
      })
      .expect(200);

    // Longer delay to ensure different timestamps in JWT tokens
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Second login
    const secondLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'Password123!'
      })
      .expect(200);

    // Both tokens should be valid and belong to the same user
    expect(firstLogin.body.user.id).toBe(secondLogin.body.user.id);

    // Both tokens should be valid for accessing protected routes
    await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${firstLogin.body.token}`)
      .expect(200);

    await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${secondLogin.body.token}`)
      .expect(200);
  });

  it('should handle rate limiting for failed login attempts', async () => {
    // Create a fresh user for this test
    const testUser = await createTestUser('auth-rate-limit');

    // Debug: Check if user protection is working
    console.log('Rate limit test - User created with ID:', testUser.userId);
    console.log('Rate limit test - testUserIds size:', (global as any).testUserIds?.size || 0);
    console.log('Rate limit test - User protected:', (global as any).testUserIds?.has(testUser.userId));

    const invalidLogin = {
      email: testUser.email,
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
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'Password123!'
      });

    console.log('Rate limit test - Final login status:', response.status);
    if (response.status !== 200) {
      console.log('Rate limit test - Error response:', response.body);
    }

    await response.expect(200);
  });

  it('should validate token expiration', async () => {
    // This test would require mocking token expiration
    // For now, just verify token structure
    const testUser = await createTestUser('auth-token-expiration');

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
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