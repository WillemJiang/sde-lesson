import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('Shopping Cart Management Integration', () => {
  let authToken: string;
  let authToken2: string;
  let productId1: string;
  let productId2: string;
  let cartId: string;
  let cartItemId1: string;
  let cartItemId2: string;

  beforeAll(async () => {
    // Register and login first test user
    const user1Data = {
      email: 'cart-test1@example.com',
      password: 'Password123!',
      first_name: 'Cart',
      last_name: 'User1'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(user1Data);

    const login1Response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'cart-test1@example.com',
        password: 'Password123!'
      });

    authToken = login1Response.body.token;

    // Register and login second test user
    const user2Data = {
      email: 'cart-test2@example.com',
      password: 'Password123!',
      first_name: 'Cart',
      last_name: 'User2'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(user2Data);

    const login2Response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'cart-test2@example.com',
        password: 'Password123!'
      });

    authToken2 = login2Response.body.token;

    // Create test products
    const product1 = {
      name: 'Test Product 1',
      description: 'First test product',
      price: 25.99,
      stock_quantity: 100,
      category: 'Test',
      sku: 'TP-001'
    };

    const product2 = {
      name: 'Test Product 2',
      description: 'Second test product',
      price: 35.99,
      stock_quantity: 50,
      category: 'Test',
      sku: 'TP-002'
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

  it('should create a new shopping cart', async () => {
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('items');
    expect(response.body).toHaveProperty('total_amount', 0);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBe(0);

    cartId = response.body.id;
  });

  it('should add item to shopping cart', async () => {
    const cartItem = {
      product_id: productId1,
      quantity: 2
    };

    const response = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('product_id', productId1);
    expect(response.body).toHaveProperty('quantity', 2);
    expect(response.body).toHaveProperty('price', 25.99);

    cartItemId1 = response.body.id;
  });

  it('should retrieve updated shopping cart with items', async () => {
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('items');
    expect(response.body.items.length).toBe(1);
    expect(response.body.items[0]).toHaveProperty('id', cartItemId1);
    expect(response.body.items[0]).toHaveProperty('quantity', 2);
    expect(response.body).toHaveProperty('total_amount', 51.98);
  });

  it('should add multiple items to shopping cart', async () => {
    const cartItem = {
      product_id: productId2,
      quantity: 1
    };

    const response = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('product_id', productId2);
    expect(response.body).toHaveProperty('quantity', 1);

    cartItemId2 = response.body.id;
  });

  it('should calculate correct total amount with multiple items', async () => {
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('items');
    expect(response.body.items.length).toBe(2);
    expect(response.body).toHaveProperty('total_amount', 87.97); // (25.99 * 2) + 35.99
  });

  it('should update cart item quantity', async () => {
    const updateData = {
      quantity: 3
    };

    const response = await request(app)
      .put(`/api/v1/cart/items/${cartItemId1}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body).toHaveProperty('id', cartItemId1);
    expect(response.body).toHaveProperty('quantity', 3);
  });

  it('should recalculate total after quantity update', async () => {
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('total_amount', 113.96); // (25.99 * 3) + 35.99
  });

  it('should prevent adding item with insufficient stock', async () => {
    const cartItem = {
      product_id: productId1,
      quantity: 200 // More than available stock
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem)
      .expect(400);
  });

  it('should handle separate carts for different users', async () => {
    // User 2's cart should be empty initially
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken2}`)
      .expect(200);

    expect(response.body).toHaveProperty('items');
    expect(response.body.items.length).toBe(0);
    expect(response.body).toHaveProperty('total_amount', 0);
  });

  it('should remove item from shopping cart', async () => {
    await request(app)
      .delete(`/api/v1/cart/items/${cartItemId2}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);

    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('items');
    expect(response.body.items.length).toBe(1);
    expect(response.body).toHaveProperty('total_amount', 77.97); // 25.99 * 3
  });

  it('should handle removal of non-existent cart item', async () => {
    await request(app)
      .delete('/api/v1/cart/items/non-existent-id')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should prevent unauthorized access to cart', async () => {
    await request(app)
      .get('/api/v1/cart')
      .expect(401);

    await request(app)
      .post('/api/v1/cart/items')
      .send({ product_id: productId1, quantity: 1 })
      .expect(401);
  });

  it('should validate cart item data', async () => {
    const invalidItem = {
      product_id: 'invalid-id',
      quantity: 1
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidItem)
      .expect(400);

    const invalidQuantity = {
      product_id: productId1,
      quantity: 0
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidQuantity)
      .expect(400);
  });

  it('should handle cart edge cases', async () => {
    // Try to update quantity to zero
    await request(app)
      .put(`/api/v1/cart/items/${cartItemId1}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ quantity: 0 })
      .expect(400);

    // Try to add duplicate item (should update quantity)
    const duplicateItem = {
      product_id: productId1,
      quantity: 1
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(duplicateItem)
      .expect(201); // Should succeed and merge with existing
  });
});