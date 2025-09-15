import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('Order Management and Cancellation Integration', () => {
  let authToken: string;
  let authToken2: string;
  let productId1: string;
  let productId2: string;
  let orderId1: string;
  let orderId2: string;
  let orderId3: string;

  beforeAll(async () => {
    // Register and login first test user
    const user1Data = {
      email: 'order-mgmt1@example.com',
      password: 'Password123!',
      first_name: 'Order',
      last_name: 'Manager1'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(user1Data);

    const login1Response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'order-mgmt1@example.com',
        password: 'Password123!'
      });

    authToken = login1Response.body.token;

    // Register and login second test user
    const user2Data = {
      email: 'order-mgmt2@example.com',
      password: 'Password123!',
      first_name: 'Order',
      last_name: 'Manager2'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(user2Data);

    const login2Response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'order-mgmt2@example.com',
        password: 'Password123!'
      });

    authToken2 = login2Response.body.token;

    // Create test products
    const product1 = {
      name: 'Management Product 1',
      description: 'Product for order management testing',
      price: 75.99,
      stock_quantity: 30,
      category: 'Test',
      sku: 'MP-001'
    };

    const product2 = {
      name: 'Management Product 2',
      description: 'Another product for order management testing',
      price: 125.99,
      stock_quantity: 20,
      category: 'Test',
      sku: 'MP-002'
    };

    const response1 = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(product1);

    const response2 = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(product2);

    productId1 = response1.body.id;
    productId2 = response2.body.id;
  });

  const createOrder = async () => {
    // Add items to cart
    const cartItem1 = {
      product_id: productId1,
      quantity: 2
    };

    const cartItem2 = {
      product_id: productId2,
      quantity: 1
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem1)
      .expect(201);

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem2)
      .expect(201);

    // Create payment intent
    const cartResponse = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const paymentData = {
      amount: cartResponse.body.total_amount,
      currency: 'usd',
      payment_method_type: 'card'
    };

    const paymentResponse = await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentData)
      .expect(201);

    // Create order
    const orderData = {
      shipping_address: {
        street: '123 Order St',
        city: 'Order City',
        state: 'Order State',
        zip_code: '12345',
        country: 'USA'
      },
      billing_address: {
        street: '123 Order St',
        city: 'Order City',
        state: 'Order State',
        zip_code: '12345',
        country: 'USA'
      },
      payment_intent_id: paymentResponse.body.payment_intent_id
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    return orderResponse.body.id;
  };

  it('should create multiple orders for testing', async () => {
    orderId1 = await createOrder();
    orderId2 = await createOrder();
    
    // Create an order for second user
    const cartItem = {
      product_id: productId1,
      quantity: 1
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken2}`)
      .send(cartItem)
      .expect(201);

    const cartResponse = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken2}`)
      .expect(200);

    const paymentData = {
      amount: cartResponse.body.total_amount,
      currency: 'usd',
      payment_method_type: 'card'
    };

    const paymentResponse = await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken2}`)
      .send(paymentData)
      .expect(201);

    const orderData = {
      shipping_address: {
        street: '456 User2 St',
        city: 'User2 City',
        state: 'User2 State',
        zip_code: '67890',
        country: 'USA'
      },
      billing_address: {
        street: '456 User2 St',
        city: 'User2 City',
        state: 'User2 State',
        zip_code: '67890',
        country: 'USA'
      },
      payment_intent_id: paymentResponse.body.payment_intent_id
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken2}`)
      .send(orderData)
      .expect(201);

    orderId3 = orderResponse.body.id;
  });

  it('should list all user orders', async () => {
    const response = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders');
    expect(Array.isArray(response.body.orders)).toBe(true);
    expect(response.body.orders.length).toBeGreaterThanOrEqual(2);

    // Verify orders belong to the user
    response.body.orders.forEach(order => {
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('total_amount');
    });
  });

  it('should filter orders by status', async () => {
    const response = await request(app)
      .get('/api/v1/orders?status=pending')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders');
    response.body.orders.forEach(order => {
      expect(order.status).toBe('pending');
    });
  });

  it('should sort orders by date', async () => {
    const response = await request(app)
      .get('/api/v1/orders?sort_by=created_at&sort_order=desc')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders');
    const orders = response.body.orders;
    for (let i = 1; i < orders.length; i++) {
      const date1 = new Date(orders[i - 1].created_at);
      const date2 = new Date(orders[i].created_at);
      expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
    }
  });

  it('should paginate orders', async () => {
    const response = await request(app)
      .get('/api/v1/orders?page=1&limit=1')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.pagination).toHaveProperty('page', 1);
    expect(response.body.pagination).toHaveProperty('limit', 1);
    expect(response.body.orders.length).toBeLessThanOrEqual(1);
  });

  it('should cancel a pending order', async () => {
    const response = await request(app)
      .post(`/api/v1/orders/${orderId1}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'cancelled');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Order cancelled successfully');
  });

  it('should verify order status after cancellation', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${orderId1}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'cancelled');
  });

  it('should prevent cancellation of non-existent order', async () => {
    await request(app)
      .post('/api/v1/orders/non-existent-order/cancel')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should prevent unauthorized order cancellation', async () => {
    // User 2 trying to cancel User 1's order
    await request(app)
      .post(`/api/v1/orders/${orderId2}/cancel`)
      .set('Authorization', `Bearer ${authToken2}`)
      .expect(403);
  });

  it('should prevent cancellation of already cancelled order', async () => {
    await request(app)
      .post(`/api/v1/orders/${orderId1}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should handle order status transitions', async () => {
    // Create a new order to test status transitions
    const newOrderId = await createOrder();

    // Initial status should be pending
    let response = await request(app)
      .get(`/api/v1/orders/${newOrderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'pending');

    // Cancel the order
    await request(app)
      .post(`/api/v1/orders/${newOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Verify status changed to cancelled
    response = await request(app)
      .get(`/api/v1/orders/${newOrderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'cancelled');
  });

  it('should search orders by ID', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${orderId2}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', orderId2);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('total_amount');
    expect(response.body).toHaveProperty('items');
  });

  it('should handle order statistics', async () => {
    const response = await request(app)
      .get('/api/v1/orders?stats=true')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders');
    expect(response.body).toHaveProperty('statistics');
    expect(response.body.statistics).toHaveProperty('total_orders');
    expect(response.body.statistics).toHaveProperty('total_amount');
    expect(response.body.statistics).toHaveProperty('orders_by_status');
  });

  it('should validate order cancellation reason', async () => {
    const cancelData = {
      reason: 'Customer requested cancellation'
    };

    const response = await request(app)
      .post(`/api/v1/orders/${orderId2}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(cancelData)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'cancelled');
    expect(response.body).toHaveProperty('cancellation_reason', 'Customer requested cancellation');
  });

  it('should handle bulk order operations', async () => {
    const response = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders');
    expect(response.body.orders.length).toBeGreaterThan(0);

    // Verify all orders have required fields
    response.body.orders.forEach(order => {
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('total_amount');
      expect(order).toHaveProperty('created_at');
      expect(order).toHaveProperty('updated_at');
    });
  });

  it('should prevent access to other users orders', async () => {
    // User 2 should not see User 1's orders
    const response = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken2}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders');
    response.body.orders.forEach(order => {
      expect(order.id).toBe(orderId3); // Should only see their own order
    });
  });
});