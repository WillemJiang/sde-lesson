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

  beforeEach(async () => {
    // Generate unique email for each test run
    const timestamp = Date.now();
    const uniqueEmail = `auth-test-${timestamp}@example.com`;

    // Register a test user first
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
      userId = registerResponse.body.user.id;
      // Store the unique email for use in tests
      (global as any).testEmail = uniqueEmail;

      // Add this user to the protected testUserIds set to prevent deletion during cleanup
      if ((global as any).testUserIds) {
        (global as any).testUserIds.add(userId);
      }
    } else {
      throw new Error(`User registration failed: ${registerResponse.status} - ${JSON.stringify(registerResponse.body)}`);
    }
  });

  it('should login with valid credentials', async () => {
    const loginData = {
      email: (global as any).testEmail,
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
      email: (global as any).testEmail,
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
    // Use the current test user created in beforeEach
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: (global as any).testEmail,
        password: 'Password123!'
      })
      .expect(200);

    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${loginResponse.body.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('email', (global as any).testEmail);
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
    // Create a new user for this test to avoid authentication issues
    const timestamp = Date.now();
    const uniqueEmail = `multi-session-${timestamp}@example.com`;
    const userData = {
      email: uniqueEmail,
      password: 'Password123!',
      first_name: 'Multi',
      last_name: 'Session'
    };

    // Register the user
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    // Add this user to the protected testUserIds set to prevent deletion during cleanup
    if (registerResponse.body.user && registerResponse.body.user.id && (global as any).testUserIds) {
      (global as any).testUserIds.add(registerResponse.body.user.id);
    }

    // First login
    const firstLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: uniqueEmail,
        password: 'Password123!'
      })
      .expect(200);

    // Longer delay to ensure different timestamps in JWT tokens
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Second login
    const secondLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: uniqueEmail,
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
    // Create a new user for this test to avoid authentication issues
    const timestamp = Date.now();
    const uniqueEmail = `rate-limit-${timestamp}@example.com`;
    const userData = {
      email: uniqueEmail,
      password: 'Password123!',
      first_name: 'Rate',
      last_name: 'Limit'
    };

    // Register the user
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    // Add this user to the protected testUserIds set to prevent deletion during cleanup
    if (registerResponse.body.user && registerResponse.body.user.id && (global as any).testUserIds) {
      (global as any).testUserIds.add(registerResponse.body.user.id);
    }

    const invalidLogin = {
      email: uniqueEmail,
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
        email: uniqueEmail,
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
        email: (global as any).testEmail,
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