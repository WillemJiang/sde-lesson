import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('POST /products', () => {
  let adminAuthToken: string;
  let userAuthToken: string;

  beforeAll(async () => {
    // Create admin user
    const adminData = {
      email: 'admin@example.com',
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

    // Create regular user
    const userData = {
      email: 'regular-user@example.com',
      password: 'Password123!',
      first_name: 'Regular',
      last_name: 'User'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    const userLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });

    userAuthToken = userLoginResponse.body.token;
  });

  it('should create product successfully with admin privileges', async () => {
    const productData = {
      name: 'Test Product',
      description: 'A test product description',
      price: 99.99,
      stock_quantity: 100,
      sku: 'TEST-001',
      category: 'electronics',
      image_url: 'https://example.com/image.jpg'
    };

    const response = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('name', productData.name);
    expect(response.body).toHaveProperty('description', productData.description);
    expect(response.body).toHaveProperty('price', productData.price);
    expect(response.body).toHaveProperty('stock_quantity', productData.stock_quantity);
    expect(response.body).toHaveProperty('sku', productData.sku);
    expect(response.body).toHaveProperty('category', productData.category);
    expect(response.body).toHaveProperty('is_active', true);
    expect(response.body).toHaveProperty('created_at');
    expect(response.body).toHaveProperty('updated_at');
  });

  it('should return 403 when user is not admin', async () => {
    const productData = {
      name: 'Unauthorized Product',
      description: 'This should not be created',
      price: 99.99,
      stock_quantity: 100,
      sku: 'UNAUTH-001',
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
      sku: 'NOAUTH-001',
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
      sku: 'INVALID-001',
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
      sku: 'INVALID-002',
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
      sku: 'INVALID-003',
      category: 'electronics'
    };

    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData)
      .expect(400);
  });

  it('should return 400 for invalid SKU (duplicate)', async () => {
    const productData = {
      name: 'First Product',
      description: 'First product creation',
      price: 99.99,
      stock_quantity: 100,
      sku: 'DUPLICATE-SKU',
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
      sku: 'DUPLICATE-SKU', // Same SKU
      category: 'electronics'
    };

    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(duplicateProductData)
      .expect(400);
  });

  it('should return 400 for invalid image URL', async () => {
    const productData = {
      name: 'Invalid URL Product',
      description: 'Product with invalid image URL',
      price: 99.99,
      stock_quantity: 100,
      sku: 'INVALID-004',
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