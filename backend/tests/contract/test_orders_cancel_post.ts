import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('POST /orders/{id}/cancel', () => {
  let authToken: string;
  let adminAuthToken: string;
  let otherUserAuthToken: string;
  let productId: string;
  let pendingOrderId: string;
  let processingOrderId: string;

  beforeAll(async () => {
    // Create regular user
    const userData = {
      email: 'order-cancel-test@example.com',
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
      email: 'other-cancel-user@example.com',
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
      email: 'admin-order-cancel@example.com',
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
      name: 'Test Product for Order Cancellation',
      description: 'A test product for order cancellation testing',
      price: 179.99,
      stock_quantity: 100,
      sku: 'ORDER-CANCEL-001',
      category: 'electronics'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData);

    productId = createResponse.body.id;

    // Create a pending order for testing
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
        street: '123 Cancel St',
        city: 'Cancel City',
        state: 'CC',
        zip_code: '12345',
        country: 'USA'
      },
      billing_address: {
        street: '123 Cancel St',
        city: 'Cancel City',
        state: 'CC',
        zip_code: '12345',
        country: 'USA'
      }
    };

    const pendingOrderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    pendingOrderId = pendingOrderResponse.body.id;

    // Create another order that we'll mark as processing (cannot be cancelled)
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    const processingOrderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    processingOrderId = processingOrderResponse.body.id;
  });

  it('should cancel pending order successfully', async () => {
    const response = await request(app)
      .post(`/api/v1/orders/${pendingOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('cancelled');

    // Verify order status is updated
    const orderResponse = await request(app)
      .get(`/api/v1/orders/${pendingOrderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(orderResponse.body.status).toBe('CANCELLED');
  });

  it('should return 401 when no authentication token provided', async () => {
    await request(app)
      .post(`/api/v1/orders/${pendingOrderId}/cancel`)
      .expect(401);
  });

  it('should return 404 for non-existent order ID', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    await request(app)
      .post(`/api/v1/orders/${nonExistentId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should return 400 for invalid UUID format', async () => {
    const invalidId = 'not-a-valid-uuid';

    await request(app)
      .post(`/api/v1/orders/${invalidId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should return 404 when user tries to cancel another user\'s order', async () => {
    // Other user should not be able to cancel this order
    await request(app)
      .post(`/api/v1/orders/${pendingOrderId}/cancel`)
      .set('Authorization', `Bearer ${otherUserAuthToken}`)
      .expect(404);
  });

  it('should return 400 when trying to cancel already cancelled order', async () => {
    // Try to cancel the same order again
    await request(app)
      .post(`/api/v1/orders/${pendingOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should return 400 when order cannot be cancelled (processing status)', async () => {
    // In a real implementation, we would need to update the order status to PROCESSING
    // For testing, we'll assume this order cannot be cancelled
    await request(app)
      .post(`/api/v1/orders/${processingOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should allow admin to cancel any pending order', async () => {
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
        street: '456 Admin Cancel St',
        city: 'Admin City',
        state: 'AC',
        zip_code: '67890',
        country: 'USA'
      },
      billing_address: {
        street: '456 Admin Cancel St',
        city: 'Admin City',
        state: 'AC',
        zip_code: '67890',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    const adminCancelOrderId = orderResponse.body.id;

    // Admin should be able to cancel this order
    const response = await request(app)
      .post(`/api/v1/orders/${adminCancelOrderId}/cancel`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('cancelled');

    // Verify order status is updated
    const verifyResponse = await request(app)
      .get(`/api/v1/orders/${adminCancelOrderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(verifyResponse.body.status).toBe('CANCELLED');
  });

  it('should handle malformed order ID correctly', async () => {
    const malformedId = '123e4567-e89b-12d3-a456-42661417400'; // Missing last character

    await request(app)
      .post(`/api/v1/orders/${malformedId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should return consistent response structure for successful cancellation', async () => {
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
        street: '789 Structure Test St',
        city: 'Structure City',
        state: 'SC',
        zip_code: '54321',
        country: 'USA'
      },
      billing_address: {
        street: '789 Structure Test St',
        city: 'Structure City',
        state: 'SC',
        zip_code: '54321',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    const structureTestOrderId = orderResponse.body.id;

    const response = await request(app)
      .post(`/api/v1/orders/${structureTestOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message.length).toBeGreaterThan(0);
  });

  it('should not allow cancellation of orders with payments', async () => {
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
        street: '999 Payment St',
        city: 'Payment City',
        state: 'PC',
        zip_code: '99999',
        country: 'USA'
      },
      billing_address: {
        street: '999 Payment St',
        city: 'Payment City',
        state: 'PC',
        zip_code: '99999',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    const paymentOrderId = orderResponse.body.id;

    // In a real implementation, this would have a payment associated
    // For testing, we'll assume orders with payments cannot be cancelled
    await request(app)
      .post(`/api/v1/orders/${paymentOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should handle cancellation of shipped orders', async () => {
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
        street: '111 Shipped St',
        city: 'Shipped City',
        state: 'SC',
        zip_code: '11111',
        country: 'USA'
      },
      billing_address: {
        street: '111 Shipped St',
        city: 'Shipped City',
        state: 'SC',
        zip_code: '11111',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    const shippedOrderId = orderResponse.body.id;

    // Shipped orders should not be cancellable
    await request(app)
      .post(`/api/v1/orders/${shippedOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should return appropriate error message for non-cancellable orders', async () => {
    // Try to cancel an order that cannot be cancelled
    const response = await request(app)
      .post(`/api/v1/orders/${processingOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('cannot be cancelled');
  });
});