import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';

describe('POST /payments/create-payment-intent', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;
  let orderId: string;

  beforeEach(async () => {
    // Create regular user
    const userData = {
      email: `payment-intent-test-${Math.random().toString(36).substring(7)}@example.com`,
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

    // Create admin user
    const adminData = {
      email: `admin-payment-intent-${Math.random().toString(36).substring(7)}@example.com`,
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

    // Create test product
    const productData = {
      name: 'Test Product for Payment Intent',
      description: 'A test product for payment intent testing',
      price: 249.99,
      stock_quantity: 100,
      sku: `PAYMENT-INTENT-${Math.random().toString(36).substring(7)}`,
      category: 'electronics'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData);

    productId = createResponse.body.data.id;

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
      .send(paymentIntentData)
      .expect(200);

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

  it('should return 400 for invalid UUID format', async () => {
    const paymentIntentData = {
      order_id: 'not-a-valid-uuid'
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(400);
  });

  it('should return 400 when order belongs to another user', async () => {
    // Create another user and order
    const otherUserData = {
      email: `other-payment-user-${Math.random().toString(36).substring(7)}@example.com`,
      password: 'Password123!',
      first_name: 'Jane',
      last_name: 'Smith'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(otherUserData);

    const otherUserLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: otherUserData.email,
        password: otherUserData.password
      });

    const otherUserAuthToken = otherUserLoginResponse.body.token;

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

    const otherOrderId = otherOrderResponse.body.id;

    // Try to create payment intent for other user's order
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

    const cancelledOrderId = orderResponse.body.id;

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

    const duplicateOrderId = orderResponse.body.id;

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

  it('should return 400 for orders with zero total amount', async () => {
    // Create an order with zero amount (edge case)
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 0
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

    const zeroAmountOrderId = orderResponse.body.id;

    // Try to create payment intent for zero amount order
    const paymentIntentData = {
      order_id: zeroAmountOrderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(400);
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

    const structureTestOrderId = orderResponse.body.id;

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

    const adminTestOrderId = orderResponse.body.id;

    // Admin should be able to create payment intent for this order
    const paymentIntentData = {
      order_id: adminTestOrderId
    };

    const response = await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(paymentIntentData)
      .expect(200);

    expect(response.body).toHaveProperty('client_secret');
    expect(response.body).toHaveProperty('payment_intent_id');
  });
});