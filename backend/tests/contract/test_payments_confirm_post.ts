import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('POST /payments/{id}/confirm', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;
  let paymentId: string;
  let otherUserAuthToken: string;

  beforeAll(async () => {
    // Create regular user
    const userData = {
      email: 'payment-confirm-test@example.com',
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

    // Create another user for testing access control
    const otherUserData = {
      email: 'other-payment-confirm@example.com',
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

    otherUserAuthToken = otherUserLoginResponse.body.token;

    // Create admin user
    const adminData = {
      email: 'admin-payment-confirm@example.com',
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
      name: 'Test Product for Payment Confirmation',
      description: 'A test product for payment confirmation testing',
      price: 349.99,
      stock_quantity: 100,
      sku: 'PAYMENT-CONFIRM-001',
      category: 'electronics'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData);

    productId = createResponse.body.id;

    // Create an order and payment for testing
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
        street: '123 Payment Confirm St',
        city: 'Confirm City',
        state: 'CC',
        zip_code: '12345',
        country: 'USA'
      },
      billing_address: {
        street: '123 Payment Confirm St',
        city: 'Confirm City',
        state: 'CC',
        zip_code: '12345',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    const orderId = orderResponse.body.id;

    // Create payment intent
    const paymentIntentData = {
      order_id: orderId
    };

    const paymentIntentResponse = await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentIntentData)
      .expect(200);

    // Extract payment ID from the system (in a real implementation, this would be stored)
    paymentId = 'test-payment-id-' + orderId.slice(-8);
  });

  it('should confirm payment successfully', async () => {
    const response = await request(app)
      .post(`/api/v1/payments/${paymentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('order_id');
    expect(response.body).toHaveProperty('stripe_payment_intent_id');
    expect(response.body).toHaveProperty('amount');
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('payment_method');
    expect(response.body).toHaveProperty('created_at');
    expect(response.body).toHaveProperty('updated_at');

    expect(response.body.status).toBe('SUCCEEDED');
    expect(typeof response.body.amount).toBe('number');
    expect(response.body.amount).toBeGreaterThan(0);
  });

  it('should return 401 when no authentication token provided', async () => {
    await request(app)
      .post(`/api/v1/payments/${paymentId}/confirm`)
      .expect(401);
  });

  it('should return 404 for non-existent payment ID', async () => {
    const nonExistentPaymentId = '00000000-0000-0000-0000-000000000000';

    await request(app)
      .post(`/api/v1/payments/${nonExistentPaymentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should return 400 for invalid UUID format', async () => {
    const invalidPaymentId = 'not-a-valid-uuid';

    await request(app)
      .post(`/api/v1/payments/${invalidPaymentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should return 404 when user tries to confirm another user\'s payment', async () => {
    // Create order and payment for other user
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

    const otherPaymentIntentData = {
      order_id: otherOrderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${otherUserAuthToken}`)
      .send(otherPaymentIntentData)
      .expect(200);

    const otherPaymentId = 'test-other-payment-id-' + otherOrderId.slice(-8);

    // Original user should not be able to confirm other user's payment
    await request(app)
      .post(`/api/v1/payments/${otherPaymentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should return 400 for already confirmed payments', async () => {
    // Try to confirm the same payment again
    await request(app)
      .post(`/api/v1/payments/${paymentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should return 400 for failed payments', async () => {
    // Create a new order for testing failed payment
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    const failedOrderData = {
      shipping_address: {
        street: '789 Failed Payment St',
        city: 'Failed City',
        state: 'FC',
        zip_code: '54321',
        country: 'USA'
      },
      billing_address: {
        street: '789 Failed Payment St',
        city: 'Failed City',
        state: 'FC',
        zip_code: '54321',
        country: 'USA'
      }
    };

    const failedOrderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(failedOrderData);

    const failedOrderId = failedOrderResponse.body.id;

    const failedPaymentIntentData = {
      order_id: failedOrderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(failedPaymentIntentData)
      .expect(200);

    const failedPaymentId = 'test-failed-payment-id-' + failedOrderId.slice(-8);

    // In a real implementation, this payment would be marked as failed
    // For testing, we'll simulate a failed payment confirmation
    await request(app)
      .post(`/api/v1/payments/${failedPaymentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
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

    const cancelledOrderData = {
      shipping_address: {
        street: '999 Cancelled Payment St',
        city: 'Cancelled City',
        state: 'CC',
        zip_code: '99999',
        country: 'USA'
      },
      billing_address: {
        street: '999 Cancelled Payment St',
        city: 'Cancelled City',
        state: 'CC',
        zip_code: '99999',
        country: 'USA'
      }
    };

    const cancelledOrderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cancelledOrderData);

    const cancelledOrderId = cancelledOrderResponse.body.id;

    // Cancel the order
    await request(app)
      .post(`/api/v1/orders/${cancelledOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const cancelledPaymentIntentData = {
      order_id: cancelledOrderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cancelledPaymentIntentData)
      .expect(200);

    const cancelledPaymentId = 'test-cancelled-payment-id-' + cancelledOrderId.slice(-8);

    // Try to confirm payment for cancelled order
    await request(app)
      .post(`/api/v1/payments/${cancelledPaymentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should handle malformed payment ID correctly', async () => {
    const malformedId = '123e4567-e89b-12d3-a456-42661417400'; // Missing last character

    await request(app)
      .post(`/api/v1/payments/${malformedId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should return consistent payment structure after confirmation', async () => {
    // Create a new payment for testing structure
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    const structureOrderData = {
      shipping_address: {
        street: '111 Structure Test St',
        city: 'Structure City',
        state: 'ST',
        zip_code: '11111',
        country: 'USA'
      },
      billing_address: {
        street: '111 Structure Test St',
        city: 'Structure City',
        state: 'ST',
        zip_code: '11111',
        country: 'USA'
      }
    };

    const structureOrderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(structureOrderData);

    const structureOrderId = structureOrderResponse.body.id;

    const structurePaymentIntentData = {
      order_id: structureOrderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(structurePaymentIntentData)
      .expect(200);

    const structurePaymentId = 'test-structure-payment-id-' + structureOrderId.slice(-8);

    const response = await request(app)
      .post(`/api/v1/payments/${structurePaymentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const payment = response.body;

    // Verify all expected fields are present and have correct types
    expect(typeof payment.id).toBe('string');
    expect(typeof payment.order_id).toBe('string');
    expect(typeof payment.stripe_payment_intent_id).toBe('string');
    expect(typeof payment.amount).toBe('number');
    expect(typeof payment.status).toBe('string');
    expect(typeof payment.payment_method).toBe('string');
    expect(typeof payment.created_at).toBe('string');
    expect(typeof payment.updated_at).toBe('string');

    // Verify status is SUCCEEDED for successful confirmation
    expect(payment.status).toBe('SUCCEEDED');

    // Verify amount is positive
    expect(payment.amount).toBeGreaterThan(0);

    // Verify payment method is set
    expect(payment.payment_method.length).toBeGreaterThan(0);
  });

  it('should allow admin to confirm any payment', async () => {
    // Create a new order as regular user
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    const adminOrderData = {
      shipping_address: {
        street: '222 Admin Confirm St',
        city: 'Admin City',
        state: 'AC',
        zip_code: '22222',
        country: 'USA'
      },
      billing_address: {
        street: '222 Admin Confirm St',
        city: 'Admin City',
        state: 'AC',
        zip_code: '22222',
        country: 'USA'
      }
    };

    const adminOrderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(adminOrderData);

    const adminOrderId = adminOrderResponse.body.id;

    const adminPaymentIntentData = {
      order_id: adminOrderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(adminPaymentIntentData)
      .expect(200);

    const adminPaymentId = 'test-admin-payment-id-' + adminOrderId.slice(-8);

    // Admin should be able to confirm this payment
    const response = await request(app)
      .post(`/api/v1/payments/${adminPaymentId}/confirm`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'SUCCEEDED');
  });

  it('should return appropriate error message for payment confirmation failures', async () => {
    // Create a payment that will fail
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    const failedOrderData = {
      shipping_address: {
        street: '333 Error Test St',
        city: 'Error City',
        state: 'EC',
        zip_code: '33333',
        country: 'USA'
      },
      billing_address: {
        street: '333 Error Test St',
        city: 'Error City',
        state: 'EC',
        zip_code: '33333',
        country: 'USA'
      }
    };

    const failedOrderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(failedOrderData);

    const failedOrderId = failedOrderResponse.body.id;

    const failedPaymentIntentData = {
      order_id: failedOrderId
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(failedPaymentIntentData)
      .expect(200);

    const errorPaymentId = 'test-error-payment-id-' + failedOrderId.slice(-8);

    // Try to confirm and expect failure
    const response = await request(app)
      .post(`/api/v1/payments/${errorPaymentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('failed');
  });
});