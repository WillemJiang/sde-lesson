import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';

describe('GET /orders/{id}', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;
  let orderId: string;
  let otherUserAuthToken: string;

  beforeEach(async () => {
    // Create regular user
    const userData = {
      email: 'order-detail-test@example.com',
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
      email: 'other-user@example.com',
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
      email: 'admin-order-detail@example.com',
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
      name: 'Test Product for Order Detail',
      description: 'A test product for order detail testing',
      price: 299.99,
      stock_quantity: 100,
      sku: 'ORDER-DETAIL-001',
      category: 'electronics'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData);

    productId = createResponse.body.id;

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
        street: '123 Order Detail St',
        city: 'Order City',
        state: 'OC',
        zip_code: '12345',
        country: 'USA'
      },
      billing_address: {
        street: '123 Order Detail St',
        city: 'Order City',
        state: 'OC',
        zip_code: '12345',
        country: 'USA'
      }
    };

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData);

    orderId = orderResponse.body.id;
  });

  it('should return order details by valid ID', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', orderId);
    expect(response.body).toHaveProperty('user_id');
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('total_amount');
    expect(response.body).toHaveProperty('created_at');
    expect(response.body).toHaveProperty('updated_at');
    expect(response.body).toHaveProperty('items_count');
    expect(response.body).toHaveProperty('items');
    expect(response.body).toHaveProperty('shipping_address');
    expect(response.body).toHaveProperty('billing_address');
    expect(response.body).toHaveProperty('payment');

    // Verify items array
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBeGreaterThan(0);

    // Verify first item structure
    const firstItem = response.body.items[0];
    expect(firstItem).toHaveProperty('id');
    expect(firstItem).toHaveProperty('product_id');
    expect(firstItem).toHaveProperty('quantity');
    expect(firstItem).toHaveProperty('price_at_time');
    expect(firstItem).toHaveProperty('product');

    // Verify shipping address
    expect(response.body.shipping_address).toHaveProperty('street', '123 Order Detail St');
    expect(response.body.shipping_address).toHaveProperty('city', 'Order City');
    expect(response.body.shipping_address).toHaveProperty('state', 'OC');
    expect(response.body.shipping_address).toHaveProperty('zip_code', '12345');
    expect(response.body.shipping_address).toHaveProperty('country', 'USA');

    // Verify billing address
    expect(response.body.billing_address).toHaveProperty('street', '123 Order Detail St');
    expect(response.body.billing_address).toHaveProperty('city', 'Order City');
    expect(response.body.billing_address).toHaveProperty('state', 'OC');
    expect(response.body.billing_address).toHaveProperty('zip_code', '12345');
    expect(response.body.billing_address).toHaveProperty('country', 'USA');
  });

  it('should return 401 when no authentication token provided', async () => {
    await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .expect(401);
  });

  it('should return 404 for non-existent order ID', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    await request(app)
      .get(`/api/v1/orders/${nonExistentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should return 400 for invalid UUID format', async () => {
    const invalidId = 'not-a-valid-uuid';

    await request(app)
      .get(`/api/v1/orders/${invalidId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should return 404 when user tries to access another user\'s order', async () => {
    // Other user should not be able to access this order
    await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherUserAuthToken}`)
      .expect(404);
  });

  it('should return consistent order detail structure', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const order = response.body;

    // Verify all expected fields are present and have correct types
    expect(typeof order.id).toBe('string');
    expect(typeof order.user_id).toBe('string');
    expect(typeof order.status).toBe('string');
    expect(typeof order.total_amount).toBe('number');
    expect(typeof order.created_at).toBe('string');
    expect(typeof order.updated_at).toBe('string');
    expect(typeof order.items_count).toBe('number');
    expect(typeof order.items).toBe('object');
    expect(typeof order.shipping_address).toBe('object');
    expect(typeof order.billing_address).toBe('object');

    // Verify status is one of allowed values
    expect(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).toContain(order.status);

    // Verify numeric constraints
    expect(order.total_amount).toBeGreaterThanOrEqual(0);
    expect(order.items_count).toBeGreaterThan(0);

    // Verify items structure
    order.items.forEach((item: any) => {
      expect(typeof item.id).toBe('string');
      expect(typeof item.product_id).toBe('string');
      expect(typeof item.quantity).toBe('number');
      expect(typeof item.price_at_time).toBe('number');
      expect(typeof item.product).toBe('object');
      expect(item.quantity).toBeGreaterThan(0);
      expect(item.price_at_time).toBeGreaterThan(0);
    });

    // Verify address structure
    ['shipping_address', 'billing_address'].forEach(addressType => {
      const address = order[addressType];
      expect(typeof address.street).toBe('string');
      expect(typeof address.city).toBe('string');
      expect(typeof address.state).toBe('string');
      expect(typeof address.zip_code).toBe('string');
      expect(typeof address.country).toBe('string');
    });
  });

  it('should include payment information when available', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const order = response.body;

    // Payment may be null for orders that haven't been paid yet
    if (order.payment) {
      expect(typeof order.payment.id).toBe('string');
      expect(typeof order.payment.order_id).toBe('string');
      expect(typeof order.payment.amount).toBe('number');
      expect(typeof order.payment.status).toBe('string');
      expect(typeof order.payment.created_at).toBe('string');
      expect(typeof order.payment.updated_at).toBe('string');

      // Verify payment status is one of allowed values
      expect(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED']).toContain(order.payment.status);

      // Verify payment amount matches order total
      expect(order.payment.amount).toBe(order.total_amount);
    }
  });

  it('should calculate correct totals from order items', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const order = response.body;

    // Calculate expected total from items
    const calculatedTotal = order.items.reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.price_at_time);
    }, 0);

    expect(order.total_amount).toBe(calculatedTotal);
    expect(order.items_count).toBe(order.items.reduce((sum: number, item: any) => sum + item.quantity, 0));
  });

  it('should handle malformed order ID correctly', async () => {
    const malformedId = '123e4567-e89b-12d3-a456-42661417400'; // Missing last character

    await request(app)
      .get(`/api/v1/orders/${malformedId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should allow admin to access any order', async () => {
    // Admin should be able to access any order
    const response = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', orderId);
  });

  it('should include complete product information in order items', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const order = response.body;
    const firstItem = order.items[0];
    const product = firstItem.product;

    // Verify complete product information is included
    expect(product).toHaveProperty('id', productId);
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('description');
    expect(product).toHaveProperty('price');
    expect(product).toHaveProperty('sku');
    expect(product).toHaveProperty('category');
    expect(product).toHaveProperty('image_url');
    expect(product).toHaveProperty('is_active');

    // Price should be current price, not necessarily the price at time of order
    expect(typeof product.price).toBe('number');
  });
});