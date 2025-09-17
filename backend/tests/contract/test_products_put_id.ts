import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';
import bcrypt from 'bcryptjs';

// Declare testUtils to make it available in this file
declare const testUtils: {
  generateUniqueEmail: (prefix: string) => string;
  generateUniqueSKU: (prefix: string) => string;
  createTestUserWithToken: (userData: any) => Promise<{ user: any; token: string }>;
  createProduct: (productData: any) => Promise<any>;
};

describe('PUT /products/{id}', () => {
  let adminAuthToken: string;
  let userAuthToken: string;
  let productId: string;

  beforeEach(async () => {
    // Create admin user with preserved token using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const adminResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('admin-put-test'),
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      is_verified: true,
      role: 'ADMIN'
    });
    adminAuthToken = adminResult.token;

    // Create regular user with preserved token
    const userResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('regular-put-test'),
      password_hash: hashedPassword,
      first_name: 'Regular',
      last_name: 'User',
      is_verified: true
    });
    userAuthToken = userResult.token;

    // Create a test product to update using test utilities
    const productData = {
      name: 'Original Product Name',
      description: 'Original product description',
      price: 99.99,
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('UPDATE-TEST'),
      category: 'electronics'
    };

    productId = (await testUtils.createProduct(productData)).id;
  });

  it('should update product successfully with admin privileges', async () => {
    const updateData = {
      name: 'Updated Product Name',
      description: 'Updated product description',
      price: 149.99,
      stock_quantity: 75,
      category: 'books',
      image_url: 'https://example.com/updated-image.jpg',
      is_active: false
    };

    const response = await request(app)
      .put(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body.data).toHaveProperty('id', productId);
    expect(response.body.data).toHaveProperty('name', updateData.name);
    expect(response.body.data).toHaveProperty('description', updateData.description);
    expect(response.body.data).toHaveProperty('price', updateData.price);
    expect(response.body.data).toHaveProperty('stock_quantity', updateData.stock_quantity);
    expect(response.body.data).toHaveProperty('category', updateData.category);
    expect(response.body.data).toHaveProperty('image_url', updateData.image_url);
    expect(response.body.data).toHaveProperty('is_active', updateData.is_active);
    expect(response.body.data).toHaveProperty('updated_at');
  });

  it('should return 403 when user is not admin', async () => {
    const updateData = {
      name: 'Unauthorized Update'
    };

    await request(app)
      .put(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${userAuthToken}`)
      .send(updateData)
      .expect(403);
  });

  it('should return 401 when no authentication token provided', async () => {
    const updateData = {
      name: 'No Auth Update'
    };

    await request(app)
      .put(`/api/v1/products/${productId}`)
      .send(updateData)
      .expect(401);
  });

  it('should return 404 for non-existent product ID', async () => {
    const nonExistentId = 'cm1234567890abcdef12345678'; // CUID format that doesn't exist
    const updateData = {
      name: 'Update Non-existent'
    };

    await request(app)
      .put(`/api/v1/products/${nonExistentId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updateData)
      .expect(404);
  });

  it('should return 400 for invalid UUID format', async () => {
    const invalidId = 'not-a-valid-uuid';
    const updateData = {
      name: 'Invalid UUID Update'
    };

    await request(app)
      .put(`/api/v1/products/${invalidId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for invalid price values', async () => {
    const updateData = {
      price: -99.99 // Negative price
    };

    await request(app)
      .put(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for invalid stock quantity', async () => {
    const updateData = {
      stock_quantity: -100 // Negative stock
    };

    await request(app)
      .put(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for name too short', async () => {
    const updateData = {
      name: 'Ab' // Too short (minimum 3 characters)
    };

    await request(app)
      .put(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for invalid image URL', async () => {
    const updateData = {
      image_url: 'not-a-valid-url'
    };

    await request(app)
      .put(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should allow partial updates (only provided fields)', async () => {
    const updateData = {
      name: 'Partially Updated Product'
      // Only updating name, other fields should remain unchanged
    };

    const response = await request(app)
      .put(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body.data).toHaveProperty('name', updateData.name);
    // Other fields should retain their previous values
    expect(response.body.data).toHaveProperty('description');
    expect(response.body.data).toHaveProperty('price');
    expect(response.body.data).toHaveProperty('stock_quantity');
  });

  it('should handle empty update data', async () => {
    await request(app)
      .put(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send({})
      .expect(200); // Empty update should return the current product data
  });

  it('should update only specified fields and preserve others', async () => {
    // First, get current product state
    const getCurrentResponse = await request(app)
      .get(`/api/v1/products/${productId}`)
      .expect(200);

    const currentProduct = getCurrentResponse.body.data;

    // Update only the price
    const updateData = {
      price: 199.99
    };

    const updateResponse = await request(app)
      .put(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updateData)
      .expect(200);

    expect(updateResponse.body.data.price).toBe(updateData.price);
    expect(updateResponse.body.data.name).toBe(currentProduct.name);
    expect(updateResponse.body.data.description).toBe(currentProduct.description);
    expect(updateResponse.body.data.stock_quantity).toBe(currentProduct.stock_quantity);
  });
});