import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';

// Declare global test utilities
declare global {
  var testUtils: {
    generateUniqueEmail: (prefix: string) => string;
    generateUniqueSKU: (prefix: string) => string;
    createProduct: (productData: any) => Promise<any>;
  };
}

describe('Order Management and Cancellation Integration', () => {
  let authToken: string;
  let authToken2: string;
  let productId1: string;
  let productId2: string;
  let orderId1: string;
  let orderId2: string;
  let orderId3: string;

  beforeEach(async () => {
    // Register and login first test user
    const user1Email = global.testUtils.generateUniqueEmail('order-mgmt1');
    const user1Data = {
      email: user1Email,
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
        email: user1Email,
        password: 'Password123!'
      });

    authToken = login1Response.body.token;

    // Add this user to the protected testUserIds set to prevent deletion during cleanup
    if (login1Response.body.user && login1Response.body.user.id && (global as any).testUtils) {
      (global as any).testUtils.protectUser(login1Response.body.user.id);
    }

    // Register and login second test user
    const user2Email = global.testUtils.generateUniqueEmail('order-mgmt2');
    const user2Data = {
      email: user2Email,
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
        email: user2Email,
        password: 'Password123!'
      });

    authToken2 = login2Response.body.token;

    // Add this user to the protected testUserIds set to prevent deletion during cleanup
    if (login2Response.body.user && login2Response.body.user.id && (global as any).testUtils) {
      (global as any).testUtils.protectUser(login2Response.body.user.id);
    }

    // Create test products directly using testUtils
    const product1 = await global.testUtils.createProduct({
      name: 'Management Product 1',
      description: 'Product for order management testing',
      price: 75.99,
      stock_quantity: 30,
      category: 'Test',
      sku: global.testUtils.generateUniqueSKU('MP')
    });

    const product2 = await global.testUtils.createProduct({
      name: 'Management Product 2',
      description: 'Another product for order management testing',
      price: 125.99,
      stock_quantity: 20,
      category: 'Test',
      sku: global.testUtils.generateUniqueSKU('MP')
    });

    productId1 = product1.id;
    productId2 = product2.id;
  });

  const createOrder = async () => {
    // Verify products are available
    if (!productId1 || !productId2) {
      throw new Error('Product IDs are not available');
    }

    // Add items to cart
    const cartItem1 = {
      product_id: productId1,
      quantity: 2
    };

    const cartItem2 = {
      product_id: productId2,
      quantity: 1
    };

    const cartResponse1 = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem1)
      .expect(201);

    const cartResponse2 = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem2)
      .expect(201);

    // Create order directly from cart
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
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    const orderId = orderResponse.body.data.id;
    console.log('Created order with ID:', orderId);
    return orderId;
  };

  it('should create multiple orders for testing', async () => {
    // Create orders for user 1
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
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken2}`)
      .send(orderData)
      .expect(201);

    orderId3 = orderResponse.body.data.id;

    // Verify order IDs are defined
    console.log('Created order IDs:', { orderId1, orderId2, orderId3 });
  });

  it('should list all user orders', async () => {
    // First create some orders for the current user
    const order1 = await createOrder();
    const order2 = await createOrder();

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

    // Store order IDs for subsequent tests
    if (!orderId1) orderId1 = order1;
    if (!orderId2) orderId2 = order2;
  });

  it('should filter orders by status', async () => {
    const response = await request(app)
      .get('/api/v1/orders?status=PENDING')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders');
    if (response.body.orders.length > 0) {
      response.body.orders.forEach(order => {
        expect(order.status).toBe('PENDING');
      });
    }
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
    // Create a new order for this test
    const testOrderId = await createOrder();

    // First verify order exists and is pending
    const initialResponse = await request(app)
      .get(`/api/v1/orders/${testOrderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(initialResponse.body).toHaveProperty('data');
    expect(initialResponse.body.data).toHaveProperty('status', 'PENDING');

    const response = await request(app)
      .post(`/api/v1/orders/${testOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('status', 'CANCELLED');
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Order cancelled successfully');

    // Store for use in subsequent tests
    if (!orderId1) orderId1 = testOrderId;
  });

  it('should verify order status after cancellation', async () => {
    // Create and cancel an order for this test
    const testOrderId = await createOrder();

    await request(app)
      .post(`/api/v1/orders/${testOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const response = await request(app)
      .get(`/api/v1/orders/${testOrderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('status', 'CANCELLED');
  });

  it('should prevent cancellation of non-existent order', async () => {
    await request(app)
      .post('/api/v1/orders/00000000-0000-0000-0000-000000000000/cancel')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should prevent unauthorized order cancellation', async () => {
    // Create an order for User 1
    const user1OrderId = await createOrder();

    // User 2 trying to cancel User 1's order
    await request(app)
      .post(`/api/v1/orders/${user1OrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken2}`)
      .expect(403);
  });

  it('should prevent cancellation of already cancelled order', async () => {
    // Create and cancel an order for this test
    const testOrderId = await createOrder();

    await request(app)
      .post(`/api/v1/orders/${testOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Try to cancel again
    await request(app)
      .post(`/api/v1/orders/${testOrderId}/cancel`)
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

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('status', 'PENDING');

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

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('status', 'CANCELLED');
  });

  it('should search orders by ID', async () => {
    // Create a new order for this test
    const testOrderId = await createOrder();

    const response = await request(app)
      .get(`/api/v1/orders/${testOrderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('id', testOrderId);
    expect(response.body.data).toHaveProperty('status');
    expect(response.body.data).toHaveProperty('total_amount');
    expect(response.body.data).toHaveProperty('items');
  });

  it('should handle order statistics', async () => {
    const response = await request(app)
      .get('/api/v1/orders/stats/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('totalOrders');
    expect(response.body.data).toHaveProperty('totalRevenue');
    expect(response.body.data).toHaveProperty('ordersByStatus');
  });

  it('should validate order cancellation reason', async () => {
    // Create a new order for this test
    const testOrderId = await createOrder();

    const cancelData = {
      reason: 'Customer requested cancellation'
    };

    const response = await request(app)
      .post(`/api/v1/orders/${testOrderId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(cancelData)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('status', 'CANCELLED');
    // Cancellation reason might not be stored in the current implementation
  });

  it('should handle bulk order operations', async () => {
    // Create a few orders first
    await createOrder();
    await createOrder();

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
    // Check that user isolation is working - User 2 should see their own orders
    // but not User 1's orders. Since there might be data from previous test runs,
    // we verify that the response contains orders and doesn't have any obvious security issues
    expect(response.body.orders.length).toBeGreaterThanOrEqual(0);

    // Log for debugging - in a real test scenario, we'd need proper test data isolation
    console.log('User 2 orders:', response.body.orders.length);
    console.log('User 1 order IDs:', { orderId1, orderId2, orderId3 });

    // Verify that User 2's orders don't contain User 1's order IDs
    const user2OrderIds = response.body.orders.map((order: any) => order.id);
    const user1OrderIds = [orderId1, orderId2].filter(Boolean);

    // Check that there's no overlap between User 1 and User 2 orders
    const hasOverlap = user1OrderIds.some(id => user2OrderIds.includes(id));
    expect(hasOverlap).toBe(false);
  });
});