import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('Product Browsing and Search Integration', () => {
  let authToken: string;
  let productId1: string;
  let productId2: string;
  let productId3: string;

  beforeAll(async () => {
    // Register and login a test user
    const userData = {
      email: 'product-test@example.com',
      password: 'Password123!',
      first_name: 'Product',
      last_name: 'Test'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'product-test@example.com',
        password: 'Password123!'
      });

    authToken = loginResponse.body.token;

    // Create test products
    const product1 = {
      name: 'Wireless Headphones',
      description: 'High-quality wireless headphones with noise cancellation',
      price: 99.99,
      stock_quantity: 50,
      category: 'Electronics',
      sku: 'WH-001'
    };

    const product2 = {
      name: 'Bluetooth Speaker',
      description: 'Portable Bluetooth speaker with excellent sound quality',
      price: 49.99,
      stock_quantity: 30,
      category: 'Electronics',
      sku: 'BS-001'
    };

    const product3 = {
      name: 'Running Shoes',
      description: 'Comfortable running shoes for athletes',
      price: 79.99,
      stock_quantity: 25,
      category: 'Sports',
      sku: 'RS-001'
    };

    const response1 = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(product1);

    const response2 = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(product2);

    const response3 = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(product3);

    productId1 = response1.body.id;
    productId2 = response2.body.id;
    productId3 = response3.body.id;
  });

  it('should retrieve all products', async () => {
    const response = await request(app)
      .get('/api/v1/products')
      .expect(200);

    expect(response.body).toHaveProperty('products');
    expect(Array.isArray(response.body.products)).toBe(true);
    expect(response.body.products.length).toBeGreaterThan(0);
  });

  it('should retrieve products with pagination', async () => {
    const response = await request(app)
      .get('/api/v1/products?page=1&limit=2')
      .expect(200);

    expect(response.body).toHaveProperty('products');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.pagination).toHaveProperty('page', 1);
    expect(response.body.pagination).toHaveProperty('limit', 2);
    expect(response.body.products.length).toBeLessThanOrEqual(2);
  });

  it('should search products by name', async () => {
    const response = await request(app)
      .get('/api/v1/products?search=Wireless')
      .expect(200);

    expect(response.body).toHaveProperty('products');
    expect(response.body.products.length).toBeGreaterThan(0);
    expect(response.body.products[0].name).toContain('Wireless');
  });

  it('should search products by category', async () => {
    const response = await request(app)
      .get('/api/v1/products?category=Electronics')
      .expect(200);

    expect(response.body).toHaveProperty('products');
    expect(response.body.products.length).toBeGreaterThan(0);
    response.body.products.forEach(product => {
      expect(product.category).toBe('Electronics');
    });
  });

  it('should filter products by price range', async () => {
    const response = await request(app)
      .get('/api/v1/products?min_price=50&max_price=100')
      .expect(200);

    expect(response.body).toHaveProperty('products');
    response.body.products.forEach(product => {
      expect(product.price).toBeGreaterThanOrEqual(50);
      expect(product.price).toBeLessThanOrEqual(100);
    });
  });

  it('should sort products by price ascending', async () => {
    const response = await request(app)
      .get('/api/v1/products?sort_by=price&sort_order=asc')
      .expect(200);

    expect(response.body).toHaveProperty('products');
    const products = response.body.products;
    for (let i = 1; i < products.length; i++) {
      expect(products[i - 1].price).toBeLessThanOrEqual(products[i].price);
    }
  });

  it('should sort products by price descending', async () => {
    const response = await request(app)
      .get('/api/v1/products?sort_by=price&sort_order=desc')
      .expect(200);

    expect(response.body).toHaveProperty('products');
    const products = response.body.products;
    for (let i = 1; i < products.length; i++) {
      expect(products[i - 1].price).toBeGreaterThanOrEqual(products[i].price);
    }
  });

  it('should retrieve single product by ID', async () => {
    const response = await request(app)
      .get(`/api/v1/products/${productId1}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', productId1);
    expect(response.body).toHaveProperty('name', 'Wireless Headphones');
    expect(response.body).toHaveProperty('price', 99.99);
  });

  it('should return 404 for non-existent product', async () => {
    await request(app)
      .get('/api/v1/products/non-existent-id')
      .expect(404);
  });

  it('should filter products by stock availability', async () => {
    const response = await request(app)
      .get('/api/v1/products?in_stock=true')
      .expect(200);

    expect(response.body).toHaveProperty('products');
    response.body.products.forEach(product => {
      expect(product.stock_quantity).toBeGreaterThan(0);
    });
  });

  it('should handle complex search with multiple filters', async () => {
    const response = await request(app)
      .get('/api/v1/products?search=wire&category=Electronics&min_price=50&max_price=150&sort_by=price&sort_order=asc')
      .expect(200);

    expect(response.body).toHaveProperty('products');
    response.body.products.forEach(product => {
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

    expect(response.body).toHaveProperty('products');
    expect(response.body.products.length).toBe(0);
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

    expect(response.body).toHaveProperty('products');
    expect(response.body.products.length).toBe(0);
  });
});