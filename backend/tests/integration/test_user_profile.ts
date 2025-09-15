import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('User Profile Management Integration', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Register a test user
    const userData = {
      email: 'profile-test@example.com',
      password: 'Password123!',
      first_name: 'Profile',
      last_name: 'Test'
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    userId = registerResponse.body.id;

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'profile-test@example.com',
        password: 'Password123!'
      });

    authToken = loginResponse.body.token;
  });

  it('should retrieve user profile', async () => {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', userId);
    expect(response.body).toHaveProperty('email', 'profile-test@example.com');
    expect(response.body).toHaveProperty('first_name', 'Profile');
    expect(response.body).toHaveProperty('last_name', 'Test');
    expect(response.body).toHaveProperty('created_at');
    expect(response.body).toHaveProperty('updated_at');
  });

  it('should update user profile information', async () => {
    const updateData = {
      first_name: 'Updated',
      last_name: 'Profile',
      phone: '+1234567890',
      address: '123 Updated St, Updated City, UC 12345'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toHaveProperty('id', userId);
    expect(response.body).toHaveProperty('first_name', 'Updated');
    expect(response.body).toHaveProperty('last_name', 'Profile');
    expect(response.body).toHaveProperty('phone', '+1234567890');
    expect(response.body).toHaveProperty('address', '123 Updated St, Updated City, UC 12345');
  });

  it('should verify profile updates are persisted', async () => {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('first_name', 'Updated');
    expect(response.body).toHaveProperty('last_name', 'Profile');
    expect(response.body).toHaveProperty('phone', '+1234567890');
  });

  it('should handle partial profile updates', async () => {
    const partialUpdate = {
      phone: '+0987654321'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(partialUpdate)
      .expect(200);

    expect(response.body).toHaveProperty('id', userId);
    expect(response.body).toHaveProperty('first_name', 'Updated'); // Should remain unchanged
    expect(response.body).toHaveProperty('last_name', 'Profile'); // Should remain unchanged
    expect(response.body).toHaveProperty('phone', '+0987654321'); // Should be updated
  });

  it('should validate profile update data', async () => {
    const invalidUpdate = {
      first_name: '', // Empty name
      phone: 'invalid-phone' // Invalid phone format
    };

    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidUpdate)
      .expect(400);
  });

  it('should prevent email changes through profile update', async () => {
    const emailUpdate = {
      email: 'new-email@example.com'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(emailUpdate)
      .expect(200);

    // Email should remain unchanged
    expect(response.body).toHaveProperty('email', 'profile-test@example.com');
  });

  it('should handle profile update with no changes', async () => {
    const noChanges = {};

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(noChanges)
      .expect(200);

    expect(response.body).toHaveProperty('id', userId);
  });

  it('should prevent unauthorized access to profile', async () => {
    await request(app)
      .get('/api/v1/users/profile')
      .expect(401);

    await request(app)
      .put('/api/v1/users/profile')
      .send({ first_name: 'Unauthorized' })
      .expect(401);
  });

  it('should handle profile update with special characters', async () => {
    const specialCharUpdate = {
      first_name: 'José María',
      last_name: 'O\'Connor-Smith',
      address: '123 Main St, Apt. 2B, New York, NY 10001'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(specialCharUpdate)
      .expect(200);

    expect(response.body).toHaveProperty('first_name', 'José María');
    expect(response.body).toHaveProperty('last_name', 'O\'Connor-Smith');
    expect(response.body).toHaveProperty('address', '123 Main St, Apt. 2B, New York, NY 10001');
  });

  it('should validate phone number formats', async () => {
    const invalidPhones = [
      { phone: '123' }, // Too short
      { phone: 'abc123def' }, // Contains letters
      { phone: '+12345678901234567890' } // Too long
    ];

    for (const invalidPhone of invalidPhones) {
      await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPhone)
        .expect(400);
    }
  });

  it('should handle address validation', async () => {
    const validAddresses = [
      { address: '123 Main St' },
      { address: '123 Main St, Apt 2B' },
      { address: '123 Main St, New York, NY 10001' },
      { address: 'P.O. Box 123, City, State 12345' }
    ];

    for (const validAddress of validAddresses) {
      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validAddress)
        .expect(200);

      expect(response.body).toHaveProperty('address', validAddress.address);
    }
  });

  it('should update profile timestamps', async () => {
    // Get initial timestamp
    const initialResponse = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const initialUpdatedAt = initialResponse.body.updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update profile
    const updateData = {
      phone: '+5551234567'
    };

    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    // Check if timestamp was updated
    const updatedResponse = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const updatedAt = new Date(updatedResponse.body.updated_at);
    const initialTime = new Date(initialUpdatedAt);
    
    expect(updatedAt.getTime()).toBeGreaterThan(initialTime.getTime());
  });

  it('should handle profile data truncation', async () => {
    const longData = {
      address: 'a'.repeat(1000) // Very long address
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(longData)
      .expect(200);

    expect(response.body.address.length).toBeLessThanOrEqual(500); // Assuming 500 char limit
  });

  it('should maintain data consistency after multiple updates', async () => {
    // Perform multiple rapid updates
    const updates = [
      { phone: '+1111111111' },
      { first_name: 'Multi' },
      { last_name: 'Update' },
      { address: '456 Multi St' }
    ];

    for (const update of updates) {
      await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(update)
        .expect(200);
    }

    // Verify final state
    const finalResponse = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(finalResponse.body).toHaveProperty('first_name', 'Multi');
    expect(finalResponse.body).toHaveProperty('last_name', 'Update');
    expect(finalResponse.body).toHaveProperty('phone', '+1111111111');
    expect(finalResponse.body).toHaveProperty('address', '456 Multi St');
  });

  it('should prevent sensitive field updates', async () => {
    const sensitiveFields = {
      is_admin: true,
      email_verified: true,
      created_at: '2020-01-01T00:00:00Z'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(sensitiveFields)
      .expect(200);

    // These fields should remain unchanged
    expect(response.body).not.toHaveProperty('is_admin', true);
    expect(response.body).not.toHaveProperty('email_verified', true);
    expect(response.body.created_at).not.toBe('2020-01-01T00:00:00Z');
  });
});