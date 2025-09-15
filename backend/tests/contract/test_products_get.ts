import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';

describe('GET /products', () => {
  let authToken: string;

  beforeEach(async () => {
    // Create and login a test user
    const userData = {
      email: 'product-test@example.com',
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
  });

  it('should return products list with default pagination', async () => {
    const response = await request(app)
      .get('/api/v1/products')
      .expect(200);

    expect(response.body.data).toHaveProperty('products');
    expect(response.body.data).toHaveProperty('page');
    expect(response.body.data).toHaveProperty('limit');
    expect(response.body.data).toHaveProperty('total');
    expect(response.body.data).toHaveProperty('totalPages');
    expect(Array.isArray(response.body.data.products)).toBe(true);
  });

  it('should return products with custom pagination', async () => {
    const response = await request(app)
      .get('/api/v1/products?page=2&limit=10')
      .expect(200);

    expect(response.body.data.page).toBe(2);
    expect(response.body.data.limit).toBe(10);
  });

  it('should filter products by category', async () => {
    const response = await request(app)
      .get('/api/v1/products?category=electronics')
      .expect(200);

    expect(response.body.data.products).toBeDefined();
    // All returned products should be in the specified category
    response.body.data.products.forEach((product: any) => {
      expect(product.category).toBe('electronics');
    });
  });

  it('should search products by name and description', async () => {
    const response = await request(app)
      .get('/api/v1/products?search=laptop')
      .expect(200);

    expect(response.body.data.products).toBeDefined();
    // Search should match in name or description
  });

  it('should filter products by price range', async () => {
    const response = await request(app)
      .get('/api/v1/products?min_price=100&max_price=1000')
      .expect(200);

    expect(response.body.data.products).toBeDefined();
    // All returned products should be within price range
    response.body.data.products.forEach((product: any) => {
      expect(product.price).toBeGreaterThanOrEqual(100);
      expect(product.price).toBeLessThanOrEqual(1000);
    });
  });

  it('should handle complex filtering with multiple parameters', async () => {
    const response = await request(app)
      .get('/api/v1/products?category=electronics&search=phone&min_price=200&max_price=800&page=1&limit=5')
      .expect(200);

    expect(response.body.data).toHaveProperty('products');
    expect(response.body.data).toHaveProperty('limit');
    expect(response.body.data.limit).toBe(5);
  });

  it('should return empty array when no products match filters', async () => {
    const response = await request(app)
      .get('/api/v1/products?category=nonexistent')
      .expect(200);

    expect(response.body.data.products).toEqual([]);
  });

  it('should validate pagination parameters', async () => {
    // Test invalid page number
    await request(app)
      .get('/api/v1/products?page=0')
      .expect(400);

    // Test invalid limit number
    await request(app)
      .get('/api/v1/products?limit=0')
      .expect(400);

    // Test limit exceeding maximum
    await request(app)
      .get('/api/v1/products?limit=200')
      .expect(400);
  });

  it('should handle invalid price range parameters', async () => {
    // Test negative min price
    await request(app)
      .get('/api/v1/products?min_price=-100')
      .expect(400);

    // Test min price greater than max price
    await request(app)
      .get('/api/v1/products?min_price=1000&max_price=100')
      .expect(400);
  });
});