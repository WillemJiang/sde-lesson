import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';

// Declare testUtils to make it available in this file
declare const testUtils: {
  generateUniqueEmail: (prefix: string) => string;
  generateUniqueSKU: (prefix: string) => string;
  createTestUserWithToken: (userData: any) => Promise<{ user: any; token: string }>;
};

describe('POST /products', () => {
  let adminAuthToken: string;
  let userAuthToken: string;

  beforeEach(async () => {
    // Generate unique emails for each test run
    const adminEmail = testUtils.generateUniqueEmail('admin-post-test');
    const userEmail = testUtils.generateUniqueEmail('regular-user');

    // Create admin user with preserved token
    const adminResult = await testUtils.createTestUserWithToken({
      email: adminEmail,
      password_hash: 'hashed_password', // Simplified for testing
      first_name: 'Admin',
      last_name: 'User'
    });
    adminAuthToken = adminResult.token;

    // Create regular user with preserved token
    const userResult = await testUtils.createTestUserWithToken({
      email: userEmail,
      password_hash: 'hashed_password', // Simplified for testing
      first_name: 'Regular',
      last_name: 'User'
    });
    userAuthToken = userResult.token;
  });

  it('should create product successfully with admin privileges', async () => {
    const productData = {
      name: 'Test Product',
      description: 'A test product description',
      price: 99.99,
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('TEST-PRODUCT'),
      category: 'electronics',
      image_url: 'https://example.com/image.jpg'
    };

    const response = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(201);

    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data).toHaveProperty('name', productData.name);
    expect(response.body.data).toHaveProperty('description', productData.description);
    expect(response.body.data).toHaveProperty('price', productData.price);
    expect(response.body.data).toHaveProperty('stock_quantity', productData.stock_quantity);
    expect(response.body.data).toHaveProperty('sku', productData.sku);
    expect(response.body.data).toHaveProperty('category', productData.category);
    expect(response.body.data).toHaveProperty('is_active', true);
    expect(response.body.data).toHaveProperty('created_at');
    expect(response.body.data).toHaveProperty('updated_at');
  });

  it('should return 403 when user is not admin', async () => {
    const productData = {
      name: 'Unauthorized Product',
      description: 'This should not be created',
      price: 99.99,
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('UNAUTH'),
      category: 'electronics'
    };

    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${userAuthToken}`)
      .send(productData)
      .expect(403);
  });

  it('should return 401 when no authentication token provided', async () => {
    const productData = {
      name: 'No Auth Product',
      description: 'This should not be created',
      price: 99.99,
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('NOAUTH'),
      category: 'electronics'
    };

    await request(app)
      .post('/api/v1/products')
      .send(productData)
      .expect(401);
  });

  it('should return 400 for missing required fields', async () => {
    const productData = {
      name: 'Incomplete Product'
      // Missing required fields: description, price, stock_quantity, sku, category
    };

    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(400);
  });

  it('should return 400 for invalid price values', async () => {
    const productData = {
      name: 'Invalid Price Product',
      description: 'Product with invalid price',
      price: -99.99, // Negative price
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('INVALID-PRICE'),
      category: 'electronics'
    };

    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(400);
  });

  it('should return 400 for invalid stock quantity', async () => {
    const productData = {
      name: 'Invalid Stock Product',
      description: 'Product with invalid stock',
      price: 99.99,
      stock_quantity: -100, // Negative stock
      sku: testUtils.generateUniqueSKU('INVALID-STOCK'),
      category: 'electronics'
    };

    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(400);
  });

  it('should return 400 for name too short', async () => {
    const productData = {
      name: 'Ab', // Too short (minimum 3 characters)
      description: 'Product with short name',
      price: 99.99,
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('INVALID-NAME'),
      category: 'electronics'
    };

    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(400);
  });

  it('should return 409 for invalid SKU (duplicate)', async () => {
    const uniqueSKU = testUtils.generateUniqueSKU('DUPLICATE');
    const productData = {
      name: 'First Product',
      description: 'First product creation',
      price: 99.99,
      stock_quantity: 100,
      sku: uniqueSKU,
      category: 'electronics'
    };

    // Create first product
    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(201);

    // Try to create product with same SKU
    const duplicateProductData = {
      name: 'Second Product',
      description: 'Product with duplicate SKU',
      price: 149.99,
      stock_quantity: 50,
      sku: uniqueSKU, // Same SKU
      category: 'electronics'
    };

    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(duplicateProductData)
      .expect(409);
  });

  it('should return 400 for invalid image URL', async () => {
    const productData = {
      name: 'Invalid URL Product',
      description: 'Product with invalid image URL',
      price: 99.99,
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('INVALID-URL'),
      category: 'electronics',
      image_url: 'not-a-valid-url'
    };

    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(400);
  });
});