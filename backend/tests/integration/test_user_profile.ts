import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('User Profile Management Integration', () => {
  let authToken: string;
  let userId: string;
  let uniqueEmail: string;

  beforeEach(async () => {
    // Generate unique email for each test run
    const timestamp = Date.now();
    uniqueEmail = `profile-test-${timestamp}@example.com`;

    // Register a test user
    const userData = {
      email: uniqueEmail,
      password: 'Password123!',
      first_name: 'Profile',
      last_name: 'Test'
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    if (registerResponse.status === 201 && registerResponse.body) {
      userId = registerResponse.body.user.id;
      authToken = registerResponse.body.token;
    } else {
      throw new Error(`User registration failed: ${registerResponse.status} - ${JSON.stringify(registerResponse.body)}`);
    }
  });

  it('should retrieve user profile', async () => {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', userId);
    expect(response.body).toHaveProperty('first_name', 'Profile');
    expect(response.body).toHaveProperty('last_name', 'Test');
    expect(response.body).toHaveProperty('created_at');
    expect(response.body).toHaveProperty('updated_at');
  });

  it('should update user profile information', async () => {
    const updateData = {
      first_name: 'Updated',
      last_name: 'Profile'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toHaveProperty('id', userId);
    expect(response.body).toHaveProperty('first_name', 'Updated');
    expect(response.body).toHaveProperty('last_name', 'Profile');
  });

  it('should verify profile updates are persisted', async () => {
    // First update the profile
    const updateData = {
      first_name: 'Updated',
      last_name: 'Profile'
    };

    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    // Then verify the updates are persisted
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('first_name', 'Updated');
    expect(response.body).toHaveProperty('last_name', 'Profile');
  });

  it('should handle partial profile updates', async () => {
    // First set initial values
    const initialUpdate = {
      first_name: 'Initial',
      last_name: 'Profile'
    };

    await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(initialUpdate)
      .expect(200);

    // Then do partial update
    const partialUpdate = {
      first_name: 'PartiallyUpdated'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(partialUpdate)
      .expect(200);

    expect(response.body).toHaveProperty('id', userId);
    expect(response.body).toHaveProperty('first_name', 'PartiallyUpdated'); // Should be updated
    expect(response.body).toHaveProperty('last_name', 'Profile'); // Should remain unchanged
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
    expect(response.body).toHaveProperty('email', uniqueEmail);
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
      last_name: 'O\'Connor-Smith'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(specialCharUpdate)
      .expect(200);

    expect(response.body).toHaveProperty('first_name', 'José María');
    expect(response.body).toHaveProperty('last_name', 'O\'Connor-Smith');
  });

  it('should validate first name format', async () => {
    const invalidNames = [
      { first_name: '' }, // Empty name
      { first_name: 'A' } // Too short (less than 2 characters)
    ];

    for (const invalidName of invalidNames) {
      await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidName)
        .expect(400);
    }
  });

  it('should handle last name validation', async () => {
    const validLastNames = [
      { last_name: 'Smith' },
      { last_name: 'O\'Connor' },
      { last_name: 'De La Cruz' }
    ];

    for (const validLastName of validLastNames) {
      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validLastName)
        .expect(200);

      expect(response.body).toHaveProperty('last_name', validLastName.last_name);
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
      first_name: 'TimestampUpdated'
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

  it('should handle profile data validation', async () => {
    const longData = {
      first_name: 'a'.repeat(100) // Very long first name
    };

    // This should succeed since there's no max length validation
    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(longData)
      .expect(200);

    expect(response.body).toHaveProperty('first_name', 'a'.repeat(100));
  });

  it('should maintain data consistency after multiple updates', async () => {
    // Perform multiple rapid updates
    const updates = [
      { first_name: 'Multi' },
      { last_name: 'Update' }
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
  });

  it('should prevent sensitive field updates', async () => {
    const sensitiveFields = {
      id: 'some-other-id',
      email: 'hacked@example.com',
      is_verified: true,
      created_at: '2020-01-01T00:00:00Z'
    };

    const response = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(sensitiveFields)
      .expect(200);

    // These fields should remain unchanged
    expect(response.body).not.toHaveProperty('id', 'some-other-id');
    expect(response.body).not.toHaveProperty('email', 'hacked@example.com');
    expect(response.body).not.toHaveProperty('is_verified', true);
    expect(response.body.created_at).not.toBe('2020-01-01T00:00:00Z');
  });
});