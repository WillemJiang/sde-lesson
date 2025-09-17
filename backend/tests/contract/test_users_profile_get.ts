import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';
import bcrypt from 'bcryptjs';

// Declare test utilities to make them available in this file
declare const testUtils: {
  generateUniqueEmail: (prefix: string) => string;
  generateUniqueSKU: (prefix: string) => string;
  createTestUserWithToken: (userData: any) => Promise<{ user: any; token: string }>;
};

describe('GET /users/profile', () => {
  let authToken: string;
  let adminAuthToken: string;
  let otherUserAuthToken: string;

  beforeEach(async () => {
    // Create regular user using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const userResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('profile-get'),
      password_hash: hashedPassword,
      first_name: 'JohnGet',
      last_name: 'DoeGet',
      is_verified: true
    });
    authToken = userResult.token;

    // Create another user for testing access control using test utilities
    const otherUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('other-profile-get'),
      password_hash: hashedPassword,
      first_name: 'JaneGet',
      last_name: 'SmithGet',
      is_verified: true
    });
    otherUserAuthToken = otherUserResult.token;

    // Create admin user using test utilities
    const adminResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('admin-profile-get'),
      password_hash: hashedPassword,
      first_name: 'AdminGet',
      last_name: 'UserGet',
      is_verified: true,
      role: 'ADMIN'
    });
    adminAuthToken = adminResult.token;
  });

  it('should return user profile successfully', async () => {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('email');
    expect(response.body).toHaveProperty('first_name', 'JohnGet');
    expect(response.body).toHaveProperty('last_name', 'DoeGet');
    expect(response.body.email).toContain('profile-get');
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
    expect(response.body).toHaveProperty('email');
    expect(response.body).toHaveProperty('first_name', 'AdminGet');
    expect(response.body).toHaveProperty('last_name', 'UserGet');
    expect(response.body.email).toContain('admin-profile-get');
    expect(response.body).toHaveProperty('is_verified');
    expect(response.body).toHaveProperty('orders_count');
    expect(response.body).toHaveProperty('total_spent');
  });

  it('should return profile with zero orders for new user', async () => {
    // Create a new user using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const newUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('new-user-profile'),
      password_hash: hashedPassword,
      first_name: 'New',
      last_name: 'User',
      is_verified: true
    });
    const newUserAuthToken = newUserResult.token;

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
    // Create a fresh user for this test to ensure authentication works
    const freshUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('timestamp-test'),
      password_hash: await bcrypt.hash('Password123!', 10),
      first_name: 'Timestamp',
      last_name: 'User',
      is_verified: true
    });

    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${freshUserResult.token}`)
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
    // Create an unverified user using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const unverifiedResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('unverified-profile'),
      password_hash: hashedPassword,
      first_name: 'Unverified',
      last_name: 'User',
      is_verified: false // Explicitly set to false
    });
    const unverifiedAuthToken = unverifiedResult.token;

    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${unverifiedAuthToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('is_verified', false);
  });
});