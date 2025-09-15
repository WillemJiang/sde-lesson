import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('Order Creation and Payment Flow Integration', () => {
  let authToken: string;
  let productId1: string;
  let productId2: string;
  let orderId: string;
  let paymentIntentId: string;

  beforeAll(async () => {
    // Register and login test user
    const userData = {
      email: 'order-payment-test@example.com',
      password: 'Password123!',
      first_name: 'Order',
      last_name: 'Test'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'order-payment-test@example.com',
        password: 'Password123!'
      });

    authToken = loginResponse.body.token;

    // Create test products
    const product1 = {
      name: 'Premium Headphones',
      description: 'High-end wireless headphones',
      price: 199.99,
      stock_quantity: 20,
      category: 'Electronics',
      sku: 'PH-001'
    };

    const product2 = {
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse',
      price: 49.99,
      stock_quantity: 50,
      category: 'Electronics',
      sku: 'WM-001'
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

  it('should add items to shopping cart', async () => {
    const cartItem1 = {
      product_id: productId1,
      quantity: 1
    };

    const cartItem2 = {
      product_id: productId2,
      quantity: 2
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

    // Verify cart total
    const cartResponse = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cartResponse.body).toHaveProperty('total_amount', 299.97); // 199.99 + (49.99 * 2)
  });

  it('should create payment intent for cart', async () => {
    const paymentData = {
      amount: 299.97,
      currency: 'usd',
      payment_method_type: 'card'
    };

    const response = await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentData)
      .expect(201);

    expect(response.body).toHaveProperty('client_secret');
    expect(response.body).toHaveProperty('payment_intent_id');
    expect(response.body).toHaveProperty('amount', 299.97);
    expect(response.body).toHaveProperty('currency', 'usd');

    paymentIntentId = response.body.payment_intent_id;
  });

  it('should create order from cart items', async () => {
    const orderData = {
      shipping_address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zip_code: '12345',
        country: 'USA'
      },
      billing_address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zip_code: '12345',
        country: 'USA'
      },
      payment_intent_id: paymentIntentId
    };

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('status', 'pending');
    expect(response.body).toHaveProperty('total_amount', 299.97);
    expect(response.body).toHaveProperty('items');
    expect(response.body).toHaveProperty('shipping_address');
    expect(response.body).toHaveProperty('billing_address');
    expect(response.body.items.length).toBe(2);

    orderId = response.body.id;
  });

  it('should retrieve created order', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', orderId);
    expect(response.body).toHaveProperty('status', 'pending');
    expect(response.body).toHaveProperty('total_amount', 299.97);
    expect(response.body).toHaveProperty('items');
    expect(response.body.items.length).toBe(2);
  });

  it('should confirm payment', async () => {
    const paymentData = {
      payment_intent_id: paymentIntentId,
      payment_method_id: 'pm_card_visa' // Mock payment method
    };

    const response = await request(app)
      .post(`/api/v1/payments/${paymentIntentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentData)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'succeeded');
    expect(response.body).toHaveProperty('payment_intent_id', paymentIntentId);
  });

  it('should update order status after payment confirmation', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('status', 'paid');
  });

  it('should list user orders', async () => {
    const response = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('orders');
    expect(Array.isArray(response.body.orders)).toBe(true);
    expect(response.body.orders.length).toBeGreaterThan(0);
    expect(response.body.orders[0]).toHaveProperty('id', orderId);
  });

  it('should handle order creation with empty cart', async () => {
    // Clear cart by removing all items
    const cartResponse = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    for (const item of cartResponse.body.items) {
      await request(app)
        .delete(`/api/v1/cart/items/${item.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    }

    // Try to create order with empty cart
    const orderData = {
      shipping_address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zip_code: '12345',
        country: 'USA'
      },
      billing_address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zip_code: '12345',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should validate payment intent creation', async () => {
    const invalidPaymentData = {
      amount: -100, // Invalid negative amount
      currency: 'usd'
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidPaymentData)
      .expect(400);

    const missingCurrency = {
      amount: 100
      // Missing currency
    };

    await request(app)
      .post('/api/v1/payments/create-payment-intent')
      .set('Authorization', `Bearer ${authToken}`)
      .send(missingCurrency)
      .expect(400);
  });

  it('should handle payment confirmation with invalid intent', async () => {
    const paymentData = {
      payment_intent_id: 'invalid-intent-id',
      payment_method_id: 'pm_card_visa'
    };

    await request(app)
      .post('/api/v1/payments/invalid-intent-id/confirm')
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentData)
      .expect(404);
  });

  it('should prevent unauthorized access to orders', async () => {
    await request(app)
      .get('/api/v1/orders')
      .expect(401);

    await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .expect(401);
  });

  it('should handle order creation with insufficient stock', async () => {
    // Create a product with limited stock
    const limitedProduct = {
      name: 'Limited Stock Item',
      description: 'Item with very limited stock',
      price: 10.00,
      stock_quantity: 1,
      category: 'Test',
      sku: 'LS-001'
    };

    const productResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(limitedProduct)
      .expect(201);

    const limitedProductId = productResponse.body.id;

    // Add more items than available stock
    const cartItem = {
      product_id: limitedProductId,
      quantity: 5 // More than available
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem)
      .expect(400);
  });

  it('should calculate order totals correctly', async () => {
    // Add items to cart again for final test
    const cartItem1 = {
      product_id: productId1,
      quantity: 1
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem1)
      .expect(201);

    // Create payment intent
    const paymentData = {
      amount: 199.99,
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
        street: '456 New St',
        city: 'New City',
        state: 'New State',
        zip_code: '67890',
        country: 'USA'
      },
      billing_address: {
        street: '456 New St',
        city: 'New City',
        state: 'New State',
        zip_code: '67890',
        country: 'USA'
      },
      payment_intent_id: paymentResponse.body.payment_intent_id
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    expect(orderResponse.body).toHaveProperty('total_amount', 199.99);
    expect(orderResponse.body).toHaveProperty('subtotal', 199.99);
    expect(orderResponse.body).toHaveProperty('tax', 0);
    expect(orderResponse.body).toHaveProperty('shipping', 0);
  });
});