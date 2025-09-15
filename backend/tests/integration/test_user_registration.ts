import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('User Registration and Email Verification Integration', () => {
  let userId: string;
  let verificationToken: string;

  it('should register a new user', async () => {
    const userData = {
      email: 'integration-test@example.com',
      password: 'Password123!',
      first_name: 'Integration',
      last_name: 'User'
    };

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('email', userData.email);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('User registered successfully');
    
    userId = response.body.id;
  });

  it('should verify email with valid token', async () => {
    // Simulate email verification token (in real app, this would come from email)
    const verificationData = {
      token: 'mock-verification-token',
      email: 'integration-test@example.com'
    };

    const response = await request(app)
      .post('/api/v1/auth/verify')
      .send(verificationData)
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Email verified successfully');
  });

  it('should prevent duplicate registration with same email', async () => {
    const userData = {
      email: 'integration-test@example.com',
      password: 'Password123!',
      first_name: 'Integration',
      last_name: 'User'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(409);
  });

  it('should handle invalid verification token', async () => {
    const verificationData = {
      token: 'invalid-token',
      email: 'integration-test@example.com'
    };

    await request(app)
      .post('/api/v1/auth/verify')
      .send(verificationData)
      .expect(400);
  });

  it('should handle verification for non-existent email', async () => {
    const verificationData = {
      token: 'mock-verification-token',
      email: 'nonexistent@example.com'
    };

    await request(app)
      .post('/api/v1/auth/verify')
      .send(verificationData)
      .expect(404);
  });

  it('should require email for verification', async () => {
    const verificationData = {
      token: 'mock-verification-token'
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
      email: 'profile-test@example.com',
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

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('email', profileUserData.email);
  });
});