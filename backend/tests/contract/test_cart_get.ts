import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';

describe('GET /cart', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;

  beforeEach(async () => {
    // Create regular user
    const userData = {
      email: 'cart-test@example.com',
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
      email: 'admin-cart@example.com',
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

    // Create a test product
    const productData = {
      name: 'Test Product for Cart',
      description: 'A test product for cart operations',
      price: 49.99,
      stock_quantity: 100,
      sku: 'CART-TEST-001',
      category: 'electronics',
      is_active: true
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData);

    productId = createResponse.body.data.id;
  });

  it('should return empty cart for new user', async () => {
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data).toHaveProperty('user_id');
    expect(response.body.data).toHaveProperty('created_at');
    expect(response.body.data).toHaveProperty('updated_at');
    expect(response.body.data).toHaveProperty('items');
    expect(response.body.data).toHaveProperty('total_items', 0);
    expect(response.body.data).toHaveProperty('total_amount', 0);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items).toHaveLength(0);
  });

  it('should return 401 when no authentication token provided', async () => {
    await request(app)
      .get('/api/v1/cart')
      .expect(401);
  });

  it('should return 401 for invalid authentication token', async () => {
    await request(app)
      .get('/api/v1/cart')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('should return cart with items when cart has products', async () => {
    // Add an item to cart first
    const addItemData = {
      product_id: productId,
      quantity: 2
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(addItemData)
      .expect(201);

    // Get the cart
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data).toHaveProperty('items');
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data).toHaveProperty('total_items', 2);
    expect(response.body.data).toHaveProperty('total_amount', 99.98); // 2 * 49.99

    // Verify cart item structure
    const cartItem = response.body.data.items[0];
    expect(cartItem).toHaveProperty('id');
    expect(cartItem).toHaveProperty('product_id', productId);
    expect(cartItem).toHaveProperty('quantity', 2);
    expect(cartItem).toHaveProperty('price_at_time', 49.99);
    expect(cartItem).toHaveProperty('product');
    expect(cartItem.product).toHaveProperty('id', productId);
    expect(cartItem.product).toHaveProperty('name', 'Test Product for Cart');
  });

  it('should return consistent cart structure', async () => {
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const cart = response.body.data;

    // Verify all expected fields are present and have correct types
    expect(typeof cart.id).toBe('string');
    expect(typeof cart.user_id).toBe('string');
    expect(typeof cart.created_at).toBe('string');
    expect(typeof cart.updated_at).toBe('string');
    expect(typeof cart.items).toBe('object');
    expect(Array.isArray(cart.items)).toBe(true);
    expect(typeof cart.total_items).toBe('number');
    expect(typeof cart.total_amount).toBe('number');

    // Verify numeric constraints
    expect(cart.total_items).toBeGreaterThanOrEqual(0);
    expect(cart.total_amount).toBeGreaterThanOrEqual(0);
  });

  it('should handle multiple items in cart correctly', async () => {
    // Create another product
    const secondProductData = {
      name: 'Second Test Product',
      description: 'Second test product for cart',
      price: 29.99,
      stock_quantity: 50,
      sku: 'CART-TEST-002',
      category: 'books',
      is_active: true
    };

    const secondProductResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(secondProductData);

    const secondProductId = secondProductResponse.body.data.id;

    // Add first item to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 2
      })
      .expect(201);

    // Add second item to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: secondProductId,
        quantity: 1
      })
      .expect(201);

    // Get the cart
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.total_items).toBe(3); // 2 + 1
    expect(response.body.data.total_amount).toBe(129.97); // (2 * 49.99) + 29.99
  });

  it('should return updated cart after item quantity changes', async () => {
    // Add an item to cart first
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 2
      })
      .expect(201);

    // Get current cart
    const initialResponse = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const initialTotal = initialResponse.body.data.total_amount;

    // Update quantity of first item
    const firstItemId = initialResponse.body.data.items[0].id;
    await request(app)
      .put(`/api/v1/cart/items/${firstItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ quantity: 3 })
      .expect(200);

    // Get updated cart
    const updatedResponse = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(updatedResponse.body.data.total_items).toBe(3); // Updated to 3
    expect(updatedResponse.body.data.total_amount).toBeGreaterThan(initialTotal);
  });

  it('should reflect cart changes immediately after operations', async () => {
    // This test ensures cart state consistency across operations
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Cart should be in a consistent state
    expect(response.body.data.total_items).toBe(
      response.body.data.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
    );

    expect(response.body.data.total_amount).toBe(
      response.body.data.items.reduce((sum: number, item: any) => sum + (item.quantity * item.price_at_time), 0)
    );
  });
});