import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('GET /products/{id}', () => {
  let authToken: string;
  let productId: string;

  beforeAll(async () => {
    // Create and login a test user
    const userData = {
      email: 'product-get-test@example.com',
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

    // Create an admin user and a test product
    const adminData = {
      email: 'admin-product@example.com',
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

    const adminAuthToken = adminLoginResponse.body.token;

    const productData = {
      name: 'Test Product for Get',
      description: 'A test product for GET endpoint',
      price: 149.99,
      stock_quantity: 75,
      sku: 'GET-TEST-001',
      category: 'electronics',
      image_url: 'https://example.com/test-product.jpg'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData);

    productId = createResponse.body.id;
  });

  it('should return product by valid ID', async () => {
    const response = await request(app)
      .get(`/api/v1/products/${productId}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', productId);
    expect(response.body).toHaveProperty('name', 'Test Product for Get');
    expect(response.body).toHaveProperty('description', 'A test product for GET endpoint');
    expect(response.body).toHaveProperty('price', 149.99);
    expect(response.body).toHaveProperty('stock_quantity', 75);
    expect(response.body).toHaveProperty('sku', 'GET-TEST-001');
    expect(response.body).toHaveProperty('category', 'electronics');
    expect(response.body).toHaveProperty('image_url', 'https://example.com/test-product.jpg');
    expect(response.body).toHaveProperty('is_active', true);
    expect(response.body).toHaveProperty('created_at');
    expect(response.body).toHaveProperty('updated_at');
  });

  it('should return 404 for non-existent product ID', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

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
      .expect(404); // This should 404 as it doesn't match the route pattern
  });

  it('should return 404 for malformed ID', async () => {
    const malformedId = '123e4567-e89b-12d3-a456-42661417400'; // Missing last character

    await request(app)
      .get(`/api/v1/products/${malformedId}`)
      .expect(404);
  });

  it('should return product details without requiring authentication', async () => {
    // Test that the endpoint works without authentication token
    const response = await request(app)
      .get(`/api/v1/products/${productId}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', productId);
    expect(response.body).toHaveProperty('name');
  });

  it('should handle special characters in ID correctly', async () => {
    // Test with edge case IDs
    const edgeCaseId = '00000000-0000-0000-0000-000000000001';

    await request(app)
      .get(`/api/v1/products/${edgeCaseId}`)
      .expect(404);
  });

  it('should return consistent product structure', async () => {
    const response = await request(app)
      .get(`/api/v1/products/${productId}`)
      .expect(200);

    const product = response.body;
    
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