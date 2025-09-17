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

describe('POST /orders', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;
  let unverifiedUserToken: string;

  beforeEach(async () => {
    // Create users with proper hashed passwords using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    const userResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('order-create'),
      password_hash: hashedPassword,
      first_name: 'John',
      last_name: 'Doe',
      is_verified: true
    });
    authToken = userResult.token;

    // Create unverified user with preserved token
    const unverifiedResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('unverified-order'),
      password_hash: hashedPassword,
      first_name: 'Jane',
      last_name: 'Doe',
      is_verified: false
    });
    unverifiedUserToken = unverifiedResult.token;

    // Create admin user with preserved token
    const adminResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('admin-order-create'),
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      is_verified: true,
      role: 'ADMIN'
    });
    adminAuthToken = adminResult.token;

    // Create test product using test utilities
    const productData = {
      name: 'Test Product for Order Creation',
      description: 'A test product for order creation testing',
      price: 159.99,
      stock_quantity: 50,
      sku: testUtils.generateUniqueSKU('ORDER-CREATE'),
      category: 'electronics'
    };

    productId = (await testUtils.createProduct(productData)).id;
  });

  it('should create order successfully with valid data', async () => {
    // Add items to cart first
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 2
      })
      .expect(201);

    const orderData = {
      shipping_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data).toHaveProperty('user_id');
    expect(response.body.data).toHaveProperty('status', 'PENDING');
    expect(response.body.data).toHaveProperty('total_amount');
    expect(response.body.data).toHaveProperty('created_at');
    expect(response.body.data).toHaveProperty('updated_at');
    expect(response.body.data).toHaveProperty('items');
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].quantity).toBe(2);
    expect(typeof response.body.data.total_amount).toBe('number');
    expect(response.body.data.total_amount).toBeGreaterThan(0);
  });

  it('should return 401 when no authentication token provided', async () => {
    const orderData = {
      shipping_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .send(orderData)
      .expect(401);
  });

  it('should allow unverified users to create orders', async () => {
    // Add items to cart for unverified user
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${unverifiedUserToken}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    const orderData = {
      shipping_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    // Current implementation allows unverified users to create orders
    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${unverifiedUserToken}`)
      .send(orderData)
      .expect(201);
  });

  it('should return 400 for missing required fields', async () => {
    const orderData = {
      // Missing shipping_address and billing_address
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should return 400 for missing shipping address', async () => {
    const orderData = {
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
      // Missing shipping_address
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should return 400 for missing billing address', async () => {
    const orderData = {
      shipping_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
      // Missing billing_address
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should return 400 for incomplete shipping address', async () => {
    // Create a new user with fresh token for this test to avoid authentication issues
    const freshUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('incomplete-address'),
      password_hash: await bcrypt.hash('Password123!', 10),
      first_name: 'Test',
      last_name: 'User',
      is_verified: true
    });

    const orderData = {
      shipping_address: {
        street: '123 Main St',
        city: 'New York'
        // Missing state, zip_code, country
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${freshUserResult.token}`)
      .send(orderData)
      .expect(400);
  });

  it('should return 400 for empty cart', async () => {
    // Create a new user with empty cart using test utilities
    const freshUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('empty-cart'),
      password_hash: await bcrypt.hash('Password123!', 10),
      first_name: 'Empty',
      last_name: 'Cart',
      is_verified: true
    });

    const newUserAuthToken = freshUserResult.token;

    const orderData = {
      shipping_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${newUserAuthToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should calculate correct total amount from cart items', async () => {
    // Create a fresh user for this test to avoid authentication issues
    const freshUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('calculate-total'),
      password_hash: await bcrypt.hash('Password123!', 10),
      first_name: 'Calculate',
      last_name: 'Total',
      is_verified: true
    });

    // Add specific items to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${freshUserResult.token}`)
      .send({
        product_id: productId,
        quantity: 3
      })
      .expect(201);

    // Get cart to verify total
    const cartResponse = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${freshUserResult.token}`)
      .expect(200);

    const expectedTotal = cartResponse.body.data.total_amount;

    const orderData = {
      shipping_address: {
        street: '456 Oak St',
        city: 'Boston',
        state: 'MA',
        zip_code: '02108',
        country: 'USA'
      },
      billing_address: {
        street: '456 Oak St',
        city: 'Boston',
        state: 'MA',
        zip_code: '02108',
        country: 'USA'
      }
    };

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${freshUserResult.token}`)
      .send(orderData)
      .expect(201);

    expect(response.body.data.total_amount).toBe(expectedTotal);
  });

  it('should handle different shipping and billing addresses', async () => {
    // Create a fresh user for this test to avoid authentication issues
    const freshUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('different-addresses'),
      password_hash: await bcrypt.hash('Password123!', 10),
      first_name: 'Different',
      last_name: 'Addresses',
      is_verified: true
    });

    // Add item to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${freshUserResult.token}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    const orderData = {
      shipping_address: {
        street: '789 Pine St',
        city: 'Los Angeles',
        state: 'CA',
        zip_code: '90210',
        country: 'USA'
      },
      billing_address: {
        street: '321 Elm St',
        city: 'Chicago',
        state: 'IL',
        zip_code: '60601',
        country: 'USA'
      }
    };

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${freshUserResult.token}`)
      .send(orderData)
      .expect(201);

    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data.status).toBe('PENDING');
  });

  it('should return 400 for invalid address data', async () => {
    const orderData = {
      shipping_address: {
        street: '', // Empty street
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should clear cart after successful order creation', async () => {
    // Add items to cart first
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    // Verify cart has items before order creation
    const cartBeforeOrder = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cartBeforeOrder.body.data.total_items).toBeGreaterThan(0);

    // Create order
    const orderData = {
      shipping_address: {
        street: '555 Maple St',
        city: 'Seattle',
        state: 'WA',
        zip_code: '98101',
        country: 'USA'
      },
      billing_address: {
        street: '555 Maple St',
        city: 'Seattle',
        state: 'WA',
        zip_code: '98101',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    // Verify cart is empty after order creation
    const cartAfterOrder = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cartAfterOrder.body.data.total_items).toBe(0);
    expect(cartAfterOrder.body.data.total_amount).toBe(0);
  });

  it('should return consistent order structure', async () => {
    // Add item to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    const orderData = {
      shipping_address: {
        street: '999 Cedar St',
        city: 'Miami',
        state: 'FL',
        zip_code: '33101',
        country: 'USA'
      },
      billing_address: {
        street: '999 Cedar St',
        city: 'Miami',
        state: 'FL',
        zip_code: '33101',
        country: 'USA'
      }
    };

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    const order = response.body.data;

    // Verify all expected fields are present and have correct types
    expect(typeof order.id).toBe('string');
    expect(typeof order.user_id).toBe('string');
    expect(typeof order.status).toBe('string');
    expect(typeof order.total_amount).toBe('number');
    expect(typeof order.created_at).toBe('string');
    expect(typeof order.updated_at).toBe('string');
    expect(Array.isArray(order.items)).toBe(true);

    // Verify status is PENDING for new orders
    expect(order.status).toBe('PENDING');

    // Verify numeric constraints
    expect(order.total_amount).toBeGreaterThan(0);
    expect(order.items.length).toBeGreaterThan(0);
  });
});