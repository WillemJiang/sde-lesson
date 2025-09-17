import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('Product Browsing and Search Integration', () => {
  let authToken: string;
  let productId1: string;
  let productId2: string;
  let productId3: string;

  beforeEach(async () => {
    // Register and login a test user with admin privileges
    // Use a unique email for each test run to avoid conflicts
    const timestamp = Date.now();
    const userData = {
      email: `admin-post-test-${timestamp}@example.com`, // Use admin email pattern with timestamp
      password: 'Password123!',
      first_name: 'Product',
      last_name: 'Test'
    };

    // Try to register, but ignore if user already exists
    await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: `admin-post-test-${timestamp}@example.com`,
        password: 'Password123!'
      });

    if (loginResponse.status !== 200) {
      throw new Error(`User login failed with status ${loginResponse.status}: ${JSON.stringify(loginResponse.body)}`);
    }

    authToken = loginResponse.body.token;

    // Create test products with unique SKUs for each test run
    const skuTimestamp = `${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    const product1 = {
      name: 'Wireless Headphones',
      description: 'High-quality wireless headphones with noise cancellation',
      price: 99.99,
      stock_quantity: 50,
      category: 'Electronics',
      sku: `WH-${skuTimestamp}-001`
    };

    const product2 = {
      name: 'Bluetooth Speaker',
      description: 'Portable Bluetooth speaker with excellent sound quality',
      price: 49.99,
      stock_quantity: 30,
      category: 'Electronics',
      sku: `BS-${skuTimestamp}-001`
    };

    const product3 = {
      name: 'Running Shoes',
      description: 'Comfortable running shoes for athletes',
      price: 79.99,
      stock_quantity: 25,
      category: 'Sports',
      sku: `RS-${skuTimestamp}-001`
    };

    const response1 = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(product1);

    if (response1.status !== 201) {
      throw new Error(`Product 1 creation failed with status ${response1.status}: ${JSON.stringify(response1.body)}`);
    }

    const response2 = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(product2);

    if (response2.status !== 201) {
      throw new Error(`Product 2 creation failed with status ${response2.status}: ${JSON.stringify(response2.body)}`);
    }

    const response3 = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(product3);

    if (response3.status !== 201) {
      throw new Error(`Product 3 creation failed with status ${response3.status}: ${JSON.stringify(response3.body)}`);
    }

    productId1 = response1.body.data.id;
    productId2 = response2.body.data.id;
    productId3 = response3.body.data.id;
  });

  it('should retrieve all products', async () => {
    const response = await request(app)
      .get('/api/v1/products')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('products');
    expect(Array.isArray(response.body.data.products)).toBe(true);
    expect(response.body.data.products.length).toBeGreaterThan(0);
  });

  it('should retrieve products with pagination', async () => {
    const response = await request(app)
      .get('/api/v1/products?page=1&limit=2')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('products');
    expect(response.body.data).toHaveProperty('page', 1);
    expect(response.body.data).toHaveProperty('limit', 2);
    expect(response.body.data.products.length).toBeLessThanOrEqual(2);
  });

  it('should search products by name', async () => {
    const response = await request(app)
      .get('/api/v1/products?search=Wireless')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('products');
    expect(response.body.data.products.length).toBeGreaterThan(0);
    expect(response.body.data.products[0].name).toContain('Wireless');
  });

  it('should search products by category', async () => {
    const response = await request(app)
      .get('/api/v1/products?category=Electronics')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('products');
    expect(response.body.data.products.length).toBeGreaterThan(0);
    response.body.data.products.forEach(product => {
      expect(product.category).toBe('Electronics');
    });
  });

  it('should filter products by price range', async () => {
    const response = await request(app)
      .get('/api/v1/products?min_price=50&max_price=100')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('products');
    response.body.data.products.forEach(product => {
      expect(product.price).toBeGreaterThanOrEqual(50);
      expect(product.price).toBeLessThanOrEqual(100);
    });
  });

  it('should sort products by price ascending', async () => {
    const response = await request(app)
      .get('/api/v1/products?sortBy=price&sortOrder=asc')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('products');
    const products = response.body.data.products;
    expect(products.length).toBe(3);

    // Check that products are sorted by price ascending: 49.99, 79.99, 99.99
    expect(products[0].price).toBe(49.99); // Bluetooth Speaker
    expect(products[1].price).toBe(79.99); // Running Shoes
    expect(products[2].price).toBe(99.99); // Wireless Headphones

    for (let i = 1; i < products.length; i++) {
      expect(products[i - 1].price).toBeLessThanOrEqual(products[i].price);
    }
  });

  it('should sort products by price descending', async () => {
    const response = await request(app)
      .get('/api/v1/products?sortBy=price&sortOrder=desc')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('products');
    const products = response.body.data.products;
    expect(products.length).toBe(3);

    // Check that products are sorted by price descending: 99.99, 79.99, 49.99
    expect(products[0].price).toBe(99.99); // Wireless Headphones
    expect(products[1].price).toBe(79.99); // Running Shoes
    expect(products[2].price).toBe(49.99); // Bluetooth Speaker

    for (let i = 1; i < products.length; i++) {
      expect(products[i - 1].price).toBeGreaterThanOrEqual(products[i].price);
    }
  });

  it('should retrieve single product by ID', async () => {
    const response = await request(app)
      .get(`/api/v1/products/${productId1}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('id', productId1);
    expect(response.body.data).toHaveProperty('name', 'Wireless Headphones');
    expect(response.body.data).toHaveProperty('price', 99.99);
  });

  it('should return 400 for invalid product ID format', async () => {
    await request(app)
      .get('/api/v1/products/non-existent-id')
      .expect(400);
  });

  it('should filter products by active status', async () => {
    const response = await request(app)
      .get('/api/v1/products?is_active=true')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('products');
    response.body.data.products.forEach(product => {
      expect(product.is_active).toBe(true);
    });
  });

  it('should handle complex search with multiple filters', async () => {
    const response = await request(app)
      .get('/api/v1/products?search=wire&category=Electronics&min_price=50&max_price=150&sortBy=price&sortOrder=asc')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('products');
    response.body.data.products.forEach(product => {
      expect(product.name.toLowerCase()).toContain('wire');
      expect(product.category).toBe('Electronics');
      expect(product.price).toBeGreaterThanOrEqual(50);
      expect(product.price).toBeLessThanOrEqual(150);
    });
  });

  it('should handle empty search results', async () => {
    const response = await request(app)
      .get('/api/v1/products?search=nonexistentproduct')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('products');
    expect(response.body.data.products.length).toBe(0);
  });

  it('should validate search parameters', async () => {
    await request(app)
      .get('/api/v1/products?min_price=invalid')
      .expect(400);

    await request(app)
      .get('/api/v1/products?page=0')
      .expect(400);

    await request(app)
      .get('/api/v1/products?limit=0')
      .expect(400);
  });

  it('should handle pagination edge cases', async () => {
    const response = await request(app)
      .get('/api/v1/products?page=999&limit=10')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('products');
    expect(response.body.data.products.length).toBe(0);
  });
});