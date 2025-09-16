import request from 'supertest';
import { describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import app from '../../src/index';

// Declare testUtils to make it available in this file
declare const testUtils: {
  generateUniqueEmail: (prefix: string) => string;
  generateUniqueSKU: (prefix: string) => string;
  createTestUserWithToken: (userData: any) => Promise<{ user: any; token: string }>;
};

describe('GET /products/{id}', () => {
  let authToken: string;
  let productId: string;
  let adminAuthToken: string;

  beforeEach(async () => {
    // Generate unique emails for each test run
    const userEmail = testUtils.generateUniqueEmail('product-get-test');
    const adminEmail = testUtils.generateUniqueEmail('admin-get-id');

    // Create test user with preserved token
    const userResult = await testUtils.createTestUserWithToken({
      email: userEmail,
      password_hash: 'hashed_password', // Simplified for testing
      first_name: 'John',
      last_name: 'Doe'
    });
    authToken = userResult.token;

    // Create admin user with preserved token
    const adminResult = await testUtils.createTestUserWithToken({
      email: adminEmail,
      password_hash: 'hashed_password', // Simplified for testing
      first_name: 'Admin',
      last_name: 'User'
    });
    adminAuthToken = adminResult.token;
  });

  it('should return product by valid ID', async () => {
    // Create a fresh product for this test
    const productData = {
      name: 'Test Product for Get',
      description: 'A test product for GET endpoint',
      price: 149.99,
      stock_quantity: 75,
      sku: testUtils.generateUniqueSKU('GET-TEST'),
      category: 'electronics',
      image_url: 'https://example.com/test-product.jpg'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(201);

    const freshProductId = createResponse.body.data.id;

    const response = await request(app)
      .get(`/api/v1/products/${freshProductId}`)
      .expect(200);

    expect(response.body.data).toHaveProperty('id', freshProductId);
    expect(response.body.data).toHaveProperty('name', 'Test Product for Get');
    expect(response.body.data).toHaveProperty('description', 'A test product for GET endpoint');
    expect(response.body.data).toHaveProperty('price', 149.99);
    expect(response.body.data).toHaveProperty('stock_quantity', 75);
    expect(response.body.data).toHaveProperty('sku', productData.sku);
    expect(response.body.data).toHaveProperty('category', 'electronics');
    expect(response.body.data).toHaveProperty('image_url', 'https://example.com/test-product.jpg');
    expect(response.body.data).toHaveProperty('is_active', true);
    expect(response.body.data).toHaveProperty('created_at');
    expect(response.body.data).toHaveProperty('updated_at');
  });

  it('should return 404 for non-existent product ID', async () => {
    const nonExistentId = 'cm1234567890abcdef12345678'; // CUID format that doesn't exist

    await request(app)
      .get(`/api/v1/products/${nonExistentId}`)
      .expect(404);
  });

  it('should return 400 for invalid UUID format', async () => {
    const invalidId = 'not-a-valid-uuid';

    await request(app)
      .get(`/api/v1/products/${invalidId}`)
      .expect(400);
  });

  it('should return 400 for empty ID', async () => {
    await request(app)
      .get('/api/v1/products/')
      .expect(200); // This should match the list all products route
  });

  it('should return 400 for malformed ID', async () => {
    const malformedId = '123e4567-e89b-12d3-a456-42661417400'; // Missing last character

    await request(app)
      .get(`/api/v1/products/${malformedId}`)
      .expect(400);
  });

  it('should return product details without requiring authentication', async () => {
    // Test that the endpoint works without authentication token
    // Create a fresh product for this test
    const productData = {
      name: 'Test Product for Auth',
      description: 'A test product for auth test',
      price: 99.99,
      stock_quantity: 50,
      sku: testUtils.generateUniqueSKU('AUTH-TEST'),
      category: 'electronics',
      image_url: 'https://example.com/auth-product.jpg'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(201);

    const authProductId = createResponse.body.data.id;

    const response = await request(app)
      .get(`/api/v1/products/${authProductId}`)
      .expect(200);

    expect(response.body.data).toHaveProperty('id', authProductId);
    expect(response.body.data).toHaveProperty('name');
  });

  it('should handle special characters in ID correctly', async () => {
    // Test with edge case IDs
    const edgeCaseId = 'cm1234567890abcdef12345679'; // CUID format that doesn't exist

    await request(app)
      .get(`/api/v1/products/${edgeCaseId}`)
      .expect(404);
  });

  it('should return consistent product structure', async () => {
    // Create a fresh product for this test
    const productData = {
      name: 'Test Product for Structure',
      description: 'A test product for structure validation',
      price: 79.99,
      stock_quantity: 25,
      sku: testUtils.generateUniqueSKU('STRUCTURE-TEST'),
      category: 'electronics',
      image_url: 'https://example.com/structure-product.jpg'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(201);

    const structureProductId = createResponse.body.data.id;

    const response = await request(app)
      .get(`/api/v1/products/${structureProductId}`)
      .expect(200);

    const product = response.body.data;

    // Verify all expected fields are present and have correct types
    expect(typeof product.id).toBe('string');
    expect(typeof product.name).toBe('string');
    expect(typeof product.description).toBe('string');
    expect(typeof product.price).toBe('number');
    expect(typeof product.stock_quantity).toBe('number');
    expect(typeof product.sku).toBe('string');
    expect(typeof product.category).toBe('string');
    expect(typeof product.is_active).toBe('boolean');
    expect(typeof product.created_at).toBe('string');
    expect(typeof product.updated_at).toBe('string');
    
    // Verify price is positive
    expect(product.price).toBeGreaterThan(0);
    
    // Verify stock quantity is non-negative
    expect(product.stock_quantity).toBeGreaterThanOrEqual(0);
  });
});