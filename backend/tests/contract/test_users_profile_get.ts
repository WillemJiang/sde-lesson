import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('GET /users/profile', () => {
  let authToken: string;
  let adminAuthToken: string;
  let otherUserAuthToken: string;

  beforeAll(async () => {
    // Create regular user
    const userData = {
      email: 'profile-test@example.com',
      password: 'Password123!',
      first_name: 'John',
      last_name: 'Doe'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });

    authToken = loginResponse.body.token;

    // Create another user for testing access control
    const otherUserData = {
      email: 'other-profile@example.com',
      password: 'Password123!',
      first_name: 'Jane',
      last_name: 'Smith'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(otherUserData);

    const otherUserLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: otherUserData.email,
        password: otherUserData.password
      });

    otherUserAuthToken = otherUserLoginResponse.body.token;

    // Create admin user
    const adminData = {
      email: 'admin-profile@example.com',
      password: 'Password123!',
      first_name: 'Admin',
      last_name: 'User'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(adminData);

    const adminLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: adminData.email,
        password: adminData.password
      });

    adminAuthToken = adminLoginResponse.body.token;
  });

  it('should return user profile successfully', async () => {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('email', 'profile-test@example.com');
    expect(response.body).toHaveProperty('first_name', 'John');
    expect(response.body).toHaveProperty('last_name', 'Doe');
    expect(response.body).toHaveProperty('is_verified');
    expect(response.body).toHaveProperty('created_at');
    expect(response.body).toHaveProperty('updated_at');
    expect(response.body).toHaveProperty('orders_count');
    expect(response.body).toHaveProperty('total_spent');

    expect(typeof response.body.id).toBe('string');
    expect(typeof response.body.is_verified).toBe('boolean');
    expect(typeof response.body.orders_count).toBe('number');
    expect(typeof response.body.total_spent).toBe('number');
    expect(response.body.orders_count).toBeGreaterThanOrEqual(0);
    expect(response.body.total_spent).toBeGreaterThanOrEqual(0);
  });

  it('should return 401 when no authentication token provided', async () => {
    await request(app)
      .get('/api/v1/users/profile')
      .expect(401);
  });

  it('should return 401 for invalid authentication token', async () => {
    await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('should return profile for admin user', async () => {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('email', 'admin-profile@example.com');
    expect(response.body).toHaveProperty('first_name', 'Admin');
    expect(response.body).toHaveProperty('last_name', 'User');
    expect(response.body).toHaveProperty('is_verified');
    expect(response.body).toHaveProperty('orders_count');
    expect(response.body).toHaveProperty('total_spent');
  });

  it('should return profile with zero orders for new user', async () => {
    // Create a new user
    const newUserData = {
      email: 'new-user-profile@example.com',
      password: 'Password123!',
      first_name: 'New',
      last_name: 'User'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(newUserData);

    const newUserLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: newUserData.email,
        password: newUserData.password
      });

    const newUserAuthToken = newUserLoginResponse.body.token;

    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${newUserAuthToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders_count', 0);
    expect(response.body).toHaveProperty('total_spent', 0);
  });

  it('should return consistent profile structure', async () => {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const profile = response.body;

    // Verify all expected fields are present and have correct types
    expect(typeof profile.id).toBe('string');
    expect(typeof profile.email).toBe('string');
    expect(typeof profile.first_name).toBe('string');
    expect(typeof profile.last_name).toBe('string');
    expect(typeof profile.is_verified).toBe('boolean');
    expect(typeof profile.created_at).toBe('string');
    expect(typeof profile.updated_at).toBe('string');
    expect(typeof profile.orders_count).toBe('number');
    expect(typeof profile.total_spent).toBe('number');

    // Verify numeric constraints
    expect(profile.orders_count).toBeGreaterThanOrEqual(0);
    expect(profile.total_spent).toBeGreaterThanOrEqual(0);

    // Verify email format
    expect(profile.email).toContain('@');

    // Verify name lengths
    expect(profile.first_name.length).toBeGreaterThanOrEqual(2);
    expect(profile.last_name.length).toBeGreaterThanOrEqual(2);
  });

  it('should not expose sensitive information in profile', async () => {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const profile = response.body;

    // Should not contain password or other sensitive data
    expect(profile).not.toHaveProperty('password');
    expect(profile).not.toHaveProperty('password_hash');
    expect(profile).not.toHaveProperty('verification_token');
    expect(profile).not.toHaveProperty('reset_token');
  });

  it('should return updated verification status', async () => {
    // Test that verification status is properly reflected
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('is_verified');
    // Verification status should be boolean
    expect(typeof response.body.is_verified).toBe('boolean');
  });

  it('should include proper timestamp fields', async () => {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const profile = response.body;

    // Verify timestamp format
    expect(new Date(profile.created_at)).toBeInstanceOf(Date);
    expect(new Date(profile.updated_at)).toBeInstanceOf(Date);
    
    // Created at should be before or equal to updated at
    expect(new Date(profile.created_at).getTime()).toBeLessThanOrEqual(
      new Date(profile.updated_at).getTime()
    );
  });

  it('should handle malformed authentication token correctly', async () => {
    await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', 'Bearer malformed-token')
      .expect(401);
  });

  it('should return profile for unverified user', async () => {
    // Create an unverified user
    const unverifiedUserData = {
      email: 'unverified-profile@example.com',
      password: 'Password123!',
      first_name: 'Unverified',
      last_name: 'User'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(unverifiedUserData);

    const unverifiedLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: unverifiedUserData.email,
        password: unverifiedUserData.password
      });

    const unverifiedAuthToken = unverifiedLoginResponse.body.token;

    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${unverifiedAuthToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('is_verified', false);
  });
});