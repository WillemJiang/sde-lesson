import request from 'supertest';
import { describe, it, expect } from '@jest/globals';
import app from '../../src/index';

describe('POST /auth/register', () => {
  it('should create a new user with valid data', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'Password123!',
      first_name: 'John',
      last_name: 'Doe'
    };

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('email', userData.email);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('User registered successfully');
  });

  it('should return 400 for invalid email', async () => {
    const userData = {
      email: 'invalid-email',
      password: 'Password123!',
      first_name: 'John',
      last_name: 'Doe'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(400);
  });

  it('should return 400 for weak password', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'weak',
      first_name: 'John',
      last_name: 'Doe'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(400);
  });

  it('should return 400 for missing required fields', async () => {
    const userData = {
      email: 'test@example.com'
      // Missing password, first_name, last_name
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(400);
  });

  it('should return 409 for duplicate email', async () => {
    const userData = {
      email: 'duplicate@example.com',
      password: 'Password123!',
      first_name: 'John',
      last_name: 'Doe'
    };

    // First request should succeed
    await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    // Second request with same email should fail
    await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(409);
  });

  it('should return 400 for name too short', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'Password123!',
      first_name: 'A',
      last_name: 'Doe'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(400);
  });
});