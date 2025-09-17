import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';
import bcrypt from 'bcryptjs';

// Declare test utilities to make them available in this file
declare const testUtils: {
  generateUniqueEmail: (prefix: string) => string;
  generateUniqueSKU: (prefix: string) => string;
  createTestUserWithToken: (userData: any) => Promise<{ user: any; token: string }>;
  createProduct: (productData: any) => Promise<any>;
};

describe('POST /payments/create-payment-intent', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;
  let orderId: string;
  let otherUserAuthToken: string;

  beforeEach(async () => {
    // Create regular user using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const userResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('payment-intent'),
      password_hash: hashedPassword,
      first_name: 'John',
      last_name: 'Doe',
      is_verified: true
    });
    authToken = userResult.token;

    // Create another user for testing access control using test utilities
    const otherUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('other-payment-intent'),
      password_hash: hashedPassword,
      first_name: 'Jane',
      last_name: 'Smith',
      is_verified: true
    });
    otherUserAuthToken = otherUserResult.token;

    // Create admin user using test utilities
    const adminResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('admin-payment-intent'),
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      is_verified: true,
      role: 'ADMIN'
    });
    adminAuthToken = adminResult.token;

    // Create test product using test utilities
    const productData = {
      name: 'Test Product for Payment Intent',
      description: 'A test product for payment intent testing',
      price: 249.99,
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('payment-intent'),
      category: 'electronics'
    };

    const product = await testUtils.createProduct(productData);
    productId = product.id;

    // Create an order for testing
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
        street: '123 Payment Intent St',
        city: 'Payment City',
        state: 'PC',
        zip_code: '12345',
        country: 'USA'
      },
      billing_address: {
        street: '123 Payment Intent St',
        city: 'Payment City',
        state: 'PC',
        zip_code: '12345',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    orderId = orderResponse.body.data.id;
  });

  it('should create payment intent successfully', async () => {
    // Create a fresh order for this test since database cleanup happens between tests
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
        street: '123 Payment Intent St',
        city: 'Payment City',
        state: 'PC',
        zip_code: '12345',
        country: 'USA'
      },
      billing_address: {
        street: '123 Payment Intent St',
        city: 'Payment City',
        state: 'PC',
        zip_code: '12345',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    const orderId = orderResponse.body.data.id;
    const paymentIntentData = {
      order_id: orderId
    };

    const response = await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData);

    // Expect 200 for success
    expect(response.status).toBe(200);

    expect(response.body).toHaveProperty('client_secret');
    expect(response.body).toHaveProperty('payment_intent_id');
    expect(typeof response.body.client_secret).toBe('string');
    expect(typeof response.body.payment_intent_id).toBe('string');
    expect(response.body.client_secret.length).toBeGreaterThan(0);
    expect(response.body.payment_intent_id.length).toBeGreaterThan(0);
  });

  it('should return 401 when no authentication token provided', async () => {
    const paymentIntentData = {
      order_id: orderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .send(paymentIntentData)
      .expect(401);
  });

  it('should return 400 for missing required fields', async () => {
    const paymentIntentData = {}; // Missing order_id

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(400);
  });

  it('should return 404 for non-existent order ID', async () => {
    const nonExistentOrderId = '00000000-0000-0000-0000-000000000000';
    const paymentIntentData = {
      order_id: nonExistentOrderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(404);
  });

  it('should return 404 for invalid order ID format', async () => {
    const paymentIntentData = {
      order_id: 'not-a-valid-uuid'
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(404);
  });

  it('should return 404 when order belongs to another user', async () => {
    // Create order for other user
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${otherUserAuthToken}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    const otherOrderData = {
      shipping_address: {
        street: '456 Other User St',
        city: 'Other City',
        state: 'OC',
        zip_code: '67890',
        country: 'USA'
      },
      billing_address: {
        street: '456 Other User St',
        city: 'Other City',
        state: 'OC',
        zip_code: '67890',
        country: 'USA'
      }
    };

    const otherOrderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${otherUserAuthToken}`)
      .send(otherOrderData);

    const otherOrderId = otherOrderResponse.body.data.id;

    // Try to create payment intent for other user's order
    // System returns 404 for security (prevents information disclosure)
    const paymentIntentData = {
      order_id: otherOrderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(404);
  });

  it('should return 400 for cancelled orders', async () => {
    // Create a new order and cancel it
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
        street: '789 Cancelled Order St',
        city: 'Cancelled City',
        state: 'CC',
        zip_code: '54321',
        country: 'USA'
      },
      billing_address: {
        street: '789 Cancelled Order St',
        city: 'Cancelled City',
        state: 'CC',
        zip_code: '54321',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    const cancelledOrderId = orderResponse.body.data.id;

    // Cancel the order
    await request(app)
      .post(`/api/v1/orders/${cancelledOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Try to create payment intent for cancelled order
    const paymentIntentData = {
      order_id: cancelledOrderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(400);
  });

  it('should return 400 for orders with existing payment intent', async () => {
    // Create a new order
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
        street: '999 Duplicate Payment St',
        city: 'Duplicate City',
        state: 'DC',
        zip_code: '99999',
        country: 'USA'
      },
      billing_address: {
        street: '999 Duplicate Payment St',
        city: 'Duplicate City',
        state: 'DC',
        zip_code: '99999',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    const duplicateOrderId = orderResponse.body.data.id;

    // Create first payment intent
    const paymentIntentData = {
      order_id: duplicateOrderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(200);

    // Try to create another payment intent for the same order
    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(400);
  });

  it('should allow payment intent for orders with zero total amount', async () => {
    // Create a free product (zero price) for testing zero amount orders
    const freeProductData = {
      name: 'Free Product for Zero Amount Test',
      description: 'A free product for testing zero amount orders',
      price: 0,
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('free-product'),
      category: 'electronics'
    };

    const freeProduct = await testUtils.createProduct(freeProductData);
    const freeProductId = freeProduct.id;

    // Add the free product to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: freeProductId,
        quantity: 1
      })
      .expect(201);

    const orderData = {
      shipping_address: {
        street: '111 Zero Amount St',
        city: 'Zero City',
        state: 'ZC',
        zip_code: '11111',
        country: 'USA'
      },
      billing_address: {
        street: '111 Zero Amount St',
        city: 'Zero City',
        state: 'ZC',
        zip_code: '11111',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    const zeroAmountOrderId = orderResponse.body.data.id;

    // Create payment intent for zero amount order
    // Current implementation allows zero amount payments
    const paymentIntentData = {
      order_id: zeroAmountOrderId
    };

    const response = await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(200);

    // Verify response structure for zero amount payment
    expect(response.body).toHaveProperty('client_secret');
    expect(response.body).toHaveProperty('payment_intent_id');
    // Note: amount and currency are not currently returned in the response
    // but the payment intent is created successfully
  });

  it('should handle malformed order ID correctly', async () => {
    const malformedId = '123e4567-e89b-12d3-a456-42661417400'; // Missing last character
    const paymentIntentData = {
      order_id: malformedId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(404);
  });

  it('should return consistent response structure', async () => {
    // Create a new order for testing response structure
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
        street: '222 Structure Test St',
        city: 'Structure City',
        state: 'ST',
        zip_code: '22222',
        country: 'USA'
      },
      billing_address: {
        street: '222 Structure Test St',
        city: 'Structure City',
        state: 'ST',
        zip_code: '22222',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    const structureTestOrderId = orderResponse.body.data.id;

    const paymentIntentData = {
      order_id: structureTestOrderId
    };

    const response = await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(200);

    expect(response.body).toHaveProperty('client_secret');
    expect(response.body).toHaveProperty('payment_intent_id');
    expect(typeof response.body.client_secret).toBe('string');
    expect(typeof response.body.payment_intent_id).toBe('string');
  });

  it('should allow admin to create payment intent for any order', async () => {
    // Create a new order as regular user
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
        street: '333 Admin Payment St',
        city: 'Admin City',
        state: 'AC',
        zip_code: '33333',
        country: 'USA'
      },
      billing_address: {
        street: '333 Admin Payment St',
        city: 'Admin City',
        state: 'AC',
        zip_code: '33333',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    const adminTestOrderId = orderResponse.body.data.id;

    // Admin should be able to create payment intent for this order
    const paymentIntentData = {
      order_id: adminTestOrderId
    };

    const response = await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(paymentIntentData);
    expect(response.status).toBe(200);

    expect(response.body).toHaveProperty('client_secret');
    expect(response.body).toHaveProperty('payment_intent_id');
  });
});