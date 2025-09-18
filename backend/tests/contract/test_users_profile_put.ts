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

describe('PUT /users/profile', () => {
  let authToken: string;
  let adminAuthToken: string;
  let otherUserAuthToken: string;

  beforeEach(async () => {
    // Create regular user using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const userResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('profile-put'),
      password_hash: hashedPassword,
      first_name: 'JohnPut',
      last_name: 'DoePut',
      is_verified: true
    });
    authToken = userResult.token;

    // Create another user for testing access control using test utilities
    const otherUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('other-profile-put'),
      password_hash: hashedPassword,
      first_name: 'JanePut',
      last_name: 'SmithPut',
      is_verified: true
    });
    otherUserAuthToken = otherUserResult.token;

    // Create admin user using test utilities
    const adminResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('admin-profile-put'),
      password_hash: hashedPassword,
      first_name: 'AdminPut',
      last_name: 'UserPut',
      is_verified: true,
      role: 'ADMIN'
    });
    adminAuthToken = adminResult.token;
  });

  it('should update user profile successfully', async () => {
    const updateData = {
      first_name: 'Johnny',
      last_name: 'Doe-Smith'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('email');
    expect(response.body.email).toContain('profile-put');
    expect(response.body).toHaveProperty('first_name', 'Johnny');
    expect(response.body).toHaveProperty('last_name', 'Doe-Smith');
    expect(response.body).toHaveProperty('is_verified');
    expect(response.body).toHaveProperty('orders_count');
    expect(response.body).toHaveProperty('total_spent');
    expect(response.body).toHaveProperty('created_at');
    expect(response.body).toHaveProperty('updated_at');

    // Verify the updated timestamp is newer than created timestamp
    expect(new Date(response.body.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(response.body.created_at).getTime()
    );
  });

  it('should return 401 when no authentication token provided', async () => {
    const updateData = {
      first_name: 'Unauthorized'
    };

    await request(app)
      .put('/api/v1/users/profile')
      .send(updateData)
      .expect(401);
  });

  it('should return 401 for invalid authentication token', async () => {
    const updateData = {
      first_name: 'Invalid Token'
    };

    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', 'Bearer invalid-token')
      .send(updateData)
      .expect(401);
  });

  it('should update only first name', async () => {
    // Create a fresh user for this test to avoid authentication issues
    const freshUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('update-first-name'),
      password_hash: await bcrypt.hash('Password123!', 10),
      first_name: 'John',
      last_name: 'Doe',
      is_verified: true
    });

    const updateData = {
      first_name: 'Jonathan'
      // Only updating first_name, last_name should remain unchanged
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${freshUserResult.token}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toHaveProperty('first_name', 'Jonathan');
    expect(response.body).toHaveProperty('last_name', 'Doe'); // Should remain unchanged
  });

  it('should update only last name', async () => {
    const updateData = {
      last_name: 'Williams'
      // Only updating last_name, first_name should remain unchanged
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toHaveProperty('first_name', 'JohnPut'); // Should remain unchanged
    expect(response.body).toHaveProperty('last_name', 'Williams');
  });

  it('should return 400 for first name too short', async () => {
    const updateData = {
      first_name: 'A' // Too short (minimum 2 characters)
    };

    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for last name too short', async () => {
    const updateData = {
      last_name: 'B' // Too short (minimum 2 characters)
    };

    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for empty first name', async () => {
    const updateData = {
      first_name: '' // Empty string
    };

    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for empty last name', async () => {
    const updateData = {
      last_name: '' // Empty string
    };

    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should handle empty update data (no-op)', async () => {
    const updateData = {}; // No fields to update

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    // Should return current profile data unchanged
    expect(response.body).toHaveProperty('first_name', 'JohnPut');
    expect(response.body).toHaveProperty('last_name', 'DoePut');
  });

  it('should return 400 for invalid data types', async () => {
    const updateData = {
      first_name: 123, // Should be string
      last_name: true // Should be string
    };

    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should ignore extra fields in request body', async () => {
    const updateData = {
      first_name: 'Updated',
      last_name: 'User',
      email: 'new-email@example.com', // Should be ignored
      is_verified: true, // Should be ignored
      orders_count: 100 // Should be ignored
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toHaveProperty('first_name', 'Updated');
    expect(response.body).toHaveProperty('last_name', 'User');
    expect(response.body).toHaveProperty('email');
    expect(response.body.email).toContain('profile-put'); // Should remain unchanged
  });

  it('should allow updates with special characters in names', async () => {
    const updateData = {
      first_name: 'José María',
      last_name: 'O\'Connor-Smith'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toHaveProperty('first_name', 'José María');
    expect(response.body).toHaveProperty('last_name', 'O\'Connor-Smith');
  });

  it('should allow updates with numbers in names', async () => {
    const updateData = {
      first_name: 'John 2nd',
      last_name: 'Smith III'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toHaveProperty('first_name', 'John 2nd');
    expect(response.body).toHaveProperty('last_name', 'Smith III');
  });

  it('should return consistent profile structure after update', async () => {
    const updateData = {
      first_name: 'Consistent',
      last_name: 'Structure'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
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

    // Verify name lengths
    expect(profile.first_name.length).toBeGreaterThanOrEqual(2);
    expect(profile.last_name.length).toBeGreaterThanOrEqual(2);
  });

  it('should preserve other profile fields during update', async () => {
    // Get current profile first
    const currentProfile = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const currentEmail = currentProfile.body.email;
    const currentIsVerified = currentProfile.body.is_verified;
    const currentOrdersCount = currentProfile.body.orders_count;
    const currentTotalSpent = currentProfile.body.total_spent;
    const currentCreatedAt = currentProfile.body.created_at;

    // Update profile
    const updateData = {
      first_name: 'Preserved',
      last_name: 'Fields'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    // Verify other fields are preserved
    expect(response.body).toHaveProperty('email', currentEmail);
    expect(response.body).toHaveProperty('is_verified', currentIsVerified);
    expect(response.body).toHaveProperty('orders_count', currentOrdersCount);
    expect(response.body).toHaveProperty('total_spent', currentTotalSpent);
    expect(response.body).toHaveProperty('created_at', currentCreatedAt);
  });

  it('should handle malformed authentication token correctly', async () => {
    const updateData = {
      first_name: 'Malformed'
    };

    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', 'Bearer malformed-token')
      .send(updateData)
      .expect(401);
  });

  it('should return 400 for invalid JSON in request body', async () => {
    // Create a fresh user for this test to ensure authentication works
    const freshUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('invalid-json-test'),
      password_hash: await bcrypt.hash('Password123!', 10),
      first_name: 'Invalid',
      last_name: 'JSON',
      is_verified: true
    });

    // Test invalid JSON by sending malformed JSON
    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${freshUserResult.token}`)
      .set('Content-Type', 'application/json')
      .send('{ malformed json missing closing brace }')  // This will be caught by JSON parsing
      .expect(400);
  });

  it('should work for admin users updating their own profile', async () => {
    const updateData = {
      first_name: 'AdminUpdated',
      last_name: 'Profile'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toHaveProperty('first_name', 'AdminUpdated');
    expect(response.body).toHaveProperty('last_name', 'Profile');
  });
});