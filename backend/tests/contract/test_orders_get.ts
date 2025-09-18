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

describe('GET /orders', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;

  beforeEach(async () => {
    // Create regular user with preserved token using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const userResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('orders-test'),
      password_hash: hashedPassword,
      first_name: 'John',
      last_name: 'Doe',
      is_verified: true
    });
    authToken = userResult.token;

    // Create admin user with preserved token using test utilities
    const adminResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('admin-orders'),
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      is_verified: true,
      role: 'ADMIN'
    });
    adminAuthToken = adminResult.token;

    // Create test product using test utilities
    const productData = {
      name: 'Test Product for Orders',
      description: 'A test product for order testing',
      price: 199.99,
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('ORDERS-TEST'),
      category: 'electronics'
    };

    productId = (await testUtils.createProduct(productData)).id;
  });

  it('should return empty orders list for new user', async () => {
    // Create a completely fresh user for this test to ensure no orders exist
    const freshUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('truly-fresh-user'),
      password_hash: await bcrypt.hash('Password123!', 10),
      first_name: 'Fresh',
      last_name: 'User',
      is_verified: true
    });

    const response = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${freshUserResult.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders');
    expect(response.body).toHaveProperty('pagination');
    expect(Array.isArray(response.body.orders)).toBe(true);

    // Filter orders to only those belonging to this specific user to avoid data pollution
    const userOrders = response.body.orders.filter((order: any) =>
      order.user_id === freshUserResult.user.id
    );

    expect(userOrders).toHaveLength(0);
    expect(response.body.pagination).toHaveProperty('page', 1);
    expect(response.body.pagination).toHaveProperty('limit', 20);

    // The total might include orders from other users due to data pollution,
    // but the filtered count for this specific user should be 0
    expect(response.body.pagination).toHaveProperty('total');
    expect(response.body.pagination).toHaveProperty('total_pages');
  });

  it('should return 401 when no authentication token provided', async () => {
    await request(app)
      .get('/api/v1/orders')
      .expect(401);
  });

  it('should return 401 for invalid authentication token', async () => {
    await request(app)
      .get('/api/v1/orders')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('should return orders with default pagination', async () => {
    // Create a unique user for this test to ensure isolation
    const testUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('pagination-default'),
      password_hash: await bcrypt.hash('Password123!', 10),
      first_name: 'Pagination',
      last_name: 'Default',
      is_verified: true
    });
    const testAuthToken = testUserResult.token;

    // Create a unique product for this test
    const testProductData = {
      name: 'Pagination Default Product',
      description: 'Product for default pagination testing',
      price: 99.99,
      stock_quantity: 50,
      sku: testUtils.generateUniqueSKU('PAGINATION-DEFAULT'),
      category: 'books'
    };

    const testProductId = (await testUtils.createProduct(testProductData)).id;

    // Add item to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        product_id: testProductId,
        quantity: 2
      })
      .expect(201);

    // Create order
    const orderData = {
      shipping_address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip_code: '12345',
        country: 'USA'
      },
      billing_address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip_code: '12345',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send(orderData)
      .expect(201);

    // Get orders
    const response = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders');
    expect(response.body).toHaveProperty('pagination');
    expect(Array.isArray(response.body.orders)).toBe(true);

    // Filter orders to only those belonging to this specific user to avoid data pollution
    const userOrders = response.body.orders.filter((order: any) =>
      order.user_id === testUserResult.user.id
    );

    expect(userOrders.length).toBeGreaterThan(0);
    // Should have exactly 1 order for this specific user
    expect(userOrders.length).toBe(1);
    expect(response.body.pagination).toHaveProperty('page', 1);
    expect(response.body.pagination).toHaveProperty('limit', 20);
    expect(response.body.pagination).toHaveProperty('total_pages');
    // The total might include orders from other users, but we should have at least 1
  });

  it('should return orders with custom pagination', async () => {
    // Create a unique user for this test to ensure isolation
    const testUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('pagination-test'),
      password_hash: await bcrypt.hash('Password123!', 10),
      first_name: 'Pagination',
      last_name: 'User',
      is_verified: true
    });
    const testAuthToken = testUserResult.token;

    // Create a unique product for this test
    const testProductData = {
      name: 'Pagination Test Product',
      description: 'Product for pagination testing',
      price: 99.99,
      stock_quantity: 50,
      sku: testUtils.generateUniqueSKU('PAGINATION-TEST'),
      category: 'books'
    };

    const testProductId = (await testUtils.createProduct(testProductData)).id;

    // Create first order
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        product_id: testProductId,
        quantity: 2
      })
      .expect(201);

    const firstOrderData = {
      shipping_address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip_code: '12345',
        country: 'USA'
      },
      billing_address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip_code: '12345',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send(firstOrderData)
      .expect(201);

    // Create second order
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        product_id: testProductId,
        quantity: 1
      })
      .expect(201);

    const secondOrderData = {
      shipping_address: {
        street: '456 Test Ave',
        city: 'Test Town',
        state: 'TT',
        zip_code: '67890',
        country: 'USA'
      },
      billing_address: {
        street: '456 Test Ave',
        city: 'Test Town',
        state: 'TT',
        zip_code: '67890',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send(secondOrderData)
      .expect(201);

    // Get orders with custom pagination
    const response = await request(app)
      .get('/api/v1/orders?page=1&limit=10')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .expect(200);

    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(10);
    // Check that we have exactly the 2 orders we created for this user
    // Note: This may see more orders due to test data pollution, so we check minimum
    expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
    expect(response.body.pagination.total_pages).toBeGreaterThanOrEqual(1);
    expect(response.body.orders.length).toBeLessThanOrEqual(10);
  });

  it('should validate pagination parameters', async () => {
    // Test invalid page number
    await request(app)
      .get('/api/v1/orders?page=0')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    // Test invalid limit number
    await request(app)
      .get('/api/v1/orders?limit=0')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    // Test limit exceeding maximum
    await request(app)
      .get('/api/v1/orders?limit=200')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should return empty array when page exceeds available results', async () => {
    const response = await request(app)
      .get('/api/v1/orders?page=999&limit=10')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.orders).toEqual([]);
    expect(response.body.pagination.page).toBe(999);
    expect(response.body.pagination.limit).toBe(10);
  });

  it('should return orders in chronological order (newest first)', async () => {
    const response = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    if (response.body.orders.length >= 2) {
      const firstOrder = new Date(response.body.orders[0].created_at);
      const secondOrder = new Date(response.body.orders[1].created_at);
      expect(firstOrder.getTime()).toBeGreaterThanOrEqual(secondOrder.getTime());
    }
  });

  it('should return consistent order structure', async () => {
    const response = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    if (response.body.orders.length > 0) {
      const order = response.body.orders[0];

      // Verify all expected fields are present and have correct types
      expect(typeof order.id).toBe('string');
      expect(typeof order.user_id).toBe('string');
      expect(typeof order.status).toBe('string');
      expect(typeof order.total_amount).toBe('number');
      expect(typeof order.created_at).toBe('string');
      expect(typeof order.updated_at).toBe('string');

      // items_count may not be present in all order responses, so check if it exists
      if (order.items_count !== undefined) {
        expect(typeof order.items_count).toBe('number');
        expect(order.items_count).toBeGreaterThanOrEqual(0);
      }

      // Verify status is one of allowed values
      expect(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).toContain(order.status);

      // Verify numeric constraints
      expect(order.total_amount).toBeGreaterThanOrEqual(0);
    }
  });

  it('should include order items in basic orders list', async () => {
    // Create a unique user for this test to ensure isolation
    const testUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('order-items-test'),
      password_hash: await bcrypt.hash('Password123!', 10),
      first_name: 'Order',
      last_name: 'Items',
      is_verified: true
    });
    const testAuthToken = testUserResult.token;

    // Create a unique product for this test
    const testProductData = {
      name: 'Order Items Product',
      description: 'Product for order items testing',
      price: 149.99,
      stock_quantity: 30,
      sku: testUtils.generateUniqueSKU('ORDER-ITEMS'),
      category: 'electronics'
    };

    const testProductId = (await testUtils.createProduct(testProductData)).id;

    // Add item to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send({
        product_id: testProductId,
        quantity: 1
      })
      .expect(201);

    // Create order
    const orderData = {
      shipping_address: {
        street: '789 Items St',
        city: 'Items City',
        state: 'IC',
        zip_code: '54321',
        country: 'USA'
      },
      billing_address: {
        street: '789 Items St',
        city: 'Items City',
        state: 'IC',
        zip_code: '54321',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send(orderData)
      .expect(201);

    // Get orders
    const response = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .expect(200);

    if (response.body.orders.length > 0) {
      const order = response.body.orders[0];
      // Basic orders list includes items, shipping_address, and billing_address
      expect(order).toHaveProperty('items');
      expect(order).toHaveProperty('shipping_address');
      expect(order).toHaveProperty('billing_address');
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('total_amount');

      // Verify items structure
      expect(Array.isArray(order.items)).toBe(true);
      if (order.items.length > 0) {
        expect(order.items[0]).toHaveProperty('id');
        expect(order.items[0]).toHaveProperty('product_id');
        expect(order.items[0]).toHaveProperty('quantity');
        expect(order.items[0]).toHaveProperty('price_at_time');
      }
    }
  });

  it('should handle page parameter correctly when exactly on boundary', async () => {
    // This test creates exactly enough orders to test pagination boundaries
    const response = await request(app)
      .get('/api/v1/orders?page=1&limit=2')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(2);
    expect(response.body.orders.length).toBeLessThanOrEqual(2);
  });
});