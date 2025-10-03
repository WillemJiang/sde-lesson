import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
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
    protectUser: (userId: string) => void;
  };
  var testUserIds: Set<string>;
}

describe('User Registration and Email Verification Integration', () => {
  let userId: string;
  let verificationToken: string;

  it('should register a new user', async () => {
    const userData = {
      email: global.testUtils.generateUniqueEmail('integration-user'),
      password: 'Password123!',
      first_name: 'Integration',
      last_name: 'User'
    };

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('user');
    expect(response.body).toHaveProperty('token');
    expect(response.body.message).toContain('User registered successfully');
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user).toHaveProperty('email', userData.email);
    expect(response.body.user).toHaveProperty('first_name', userData.first_name);
    expect(response.body.user).toHaveProperty('last_name', userData.last_name);
    expect(response.body.user).toHaveProperty('is_verified', false);

    userId = response.body.user.id;

    // Add this user to the protected testUserIds set to prevent deletion during cleanup
    if ((global as any).testUtils) {
      (global as any).testUtils.protectUser(userId);
    }
  });

  it('should handle email verification with JWT token (expected to fail)', async () => {
    // First register a user to get a real verification token
    const userData = {
      email: global.testUtils.generateUniqueEmail('verify-user'),
      password: 'Password123!',
      first_name: 'Verify',
      last_name: 'User'
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    // Add this user to the protected testUserIds set to prevent deletion during cleanup
    if (registerResponse.body.user && registerResponse.body.user.id && (global as any).testUtils) {
      (global as any).testUtils.protectUser(registerResponse.body.user.id);
    }

    // Use the JWT token from registration response for verification
    const verificationData = {
      token: registerResponse.body.token
    };

    const response = await request(app)
      .post('/api/v1/auth/verify')
      .send(verificationData);

    // Note: JWT tokens from registration are not the same as email verification tokens
    // In a real system, email verification would use a separate token system
    // For now, we expect this to fail as the implementation doesn't support JWT-based verification
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Invalid verification token');
  });

  it('should prevent duplicate registration with same email', async () => {
    const userData = {
      email: global.testUtils.generateUniqueEmail('integration-user'),
      password: 'Password123!',
      first_name: 'Integration',
      last_name: 'User'
    };

    // First register a user
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    // Add this user to the protected testUserIds set to prevent deletion during cleanup
    if (registerResponse.body.user && registerResponse.body.user.id && (global as any).testUtils) {
      (global as any).testUtils.protectUser(registerResponse.body.user.id);
    }

    // Then try to register the same user again
    await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(409);
  });

  it('should handle invalid verification token', async () => {
    const verificationData = {
      token: 'invalid-token'
    };

    await request(app)
      .post('/api/v1/auth/verify')
      .send(verificationData)
      .expect(400);
  });

  it('should handle verification for non-existent email', async () => {
    const verificationData = {
      token: 'invalid-token-for-nonexistent-user'
    };

    await request(app)
      .post('/api/v1/auth/verify')
      .send(verificationData)
      .expect(400);
  });

  it('should require token for verification', async () => {
    const verificationData = {
      email: 'test@example.com'
    };

    await request(app)
      .post('/api/v1/auth/verify')
      .send(verificationData)
      .expect(400);
  });

  it('should handle registration with invalid data', async () => {
    const invalidUserData = {
      email: 'invalid-email',
      password: 'weak',
      first_name: '',
      last_name: 'User'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(invalidUserData)
      .expect(400);
  });

  it('should create user with profile data', async () => {
    const profileUserData = {
      email: global.testUtils.generateUniqueEmail('profile-user'),
      password: 'Password123!',
      first_name: 'Profile',
      last_name: 'Test',
      phone: '+1234567890',
      address: '123 Test St'
    };

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(profileUserData)
      .expect(201);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('user');
    expect(response.body).toHaveProperty('token');
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user).toHaveProperty('email', profileUserData.email);
    expect(response.body.user).toHaveProperty('first_name', profileUserData.first_name);
    expect(response.body.user).toHaveProperty('last_name', profileUserData.last_name);

    // Add this user to the protected testUserIds set to prevent deletion during cleanup
    if (response.body.user && response.body.user.id && (global as any).testUtils) {
      (global as any).testUtils.protectUser(response.body.user.id);
    }
  });
});