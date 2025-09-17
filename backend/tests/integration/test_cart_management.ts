import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';
import bcrypt from 'bcryptjs';

// Declare test utilities globally
declare global {
  var testUtils: {
    createUser: (userData: any) => Promise<any>;
    createProduct: (productData: any) => Promise<any>;
    generateUniqueEmail: (prefix: string) => string;
    generateUniqueSKU: (prefix: string) => string;
    createTestUserWithToken: (userData: any) => Promise<{ user: any; token: string }>;
    validateToken: (token: string) => any;
  };
}

describe('Shopping Cart Management Integration', () => {
  let authToken: string;
  let authToken2: string;
  let productId1: string;
  let productId2: string;
  let cartId: string;
  let cartItemId1: string;
  let cartItemId2: string;

  beforeEach(async () => {
    // Create first test user using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const user1Result = await global.testUtils.createTestUserWithToken({
      email: global.testUtils.generateUniqueEmail('cart-integration-1'),
      password_hash: hashedPassword,
      first_name: 'Cart',
      last_name: 'User1',
      is_verified: true
    });
    authToken = user1Result.token;

    // Create second test user using test utilities
    const user2Result = await global.testUtils.createTestUserWithToken({
      email: global.testUtils.generateUniqueEmail('cart-integration-2'),
      password_hash: hashedPassword,
      first_name: 'Cart',
      last_name: 'User2',
      is_verified: true
    });
    authToken2 = user2Result.token;

    // Create test products using test utilities
    const product1 = {
      name: 'Test Product 1',
      description: 'First test product',
      price: 25.99,
      stock_quantity: 100,
      category: 'Test',
      sku: global.testUtils.generateUniqueSKU('TP-001')
    };

    const product2 = {
      name: 'Test Product 2',
      description: 'Second test product',
      price: 35.99,
      stock_quantity: 50,
      category: 'Test',
      sku: global.testUtils.generateUniqueSKU('TP-002')
    };

    productId1 = (await global.testUtils.createProduct(product1)).id;
    productId2 = (await global.testUtils.createProduct(product2)).id;
  });

  it('should create a new shopping cart', async () => {
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data).toHaveProperty('items');
    expect(response.body.data).toHaveProperty('total_amount', 0);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items.length).toBe(0);

    cartId = response.body.data.id;
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

    const addedItem = response.body.data.items[0];
    expect(addedItem).toHaveProperty('id');
    expect(addedItem).toHaveProperty('product_id', productId1);
    expect(addedItem).toHaveProperty('quantity', 2);
    expect(addedItem).toHaveProperty('price_at_time', 25.99);

    cartItemId1 = addedItem.id;
  });

  it('should retrieve updated shopping cart with items', async () => {
    // First add an item to ensure we have something to retrieve
    const cartItem = {
      product_id: productId1,
      quantity: 2
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem)
      .expect(201);

    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data).toHaveProperty('items');
    expect(response.body.data.items.length).toBe(1);
    expect(response.body.data.items[0]).toHaveProperty('product_id', productId1);
    expect(response.body.data.items[0]).toHaveProperty('quantity', 2);
    expect(response.body.data).toHaveProperty('total_amount', 51.98);

    // Update cartItemId1 with the actual ID from the response
    cartItemId1 = response.body.data.items[0].id;
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

    const addedItem = response.body.data.items.find((item: any) => item.product_id === productId2);
    expect(addedItem).toHaveProperty('id');
    expect(addedItem).toHaveProperty('product_id', productId2);
    expect(addedItem).toHaveProperty('quantity', 1);

    cartItemId2 = addedItem.id;
  });

  it('should calculate correct total amount with multiple items', async () => {
    // Add both items to cart for this test
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

    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data).toHaveProperty('items');
    expect(response.body.data.items.length).toBe(2);
    expect(response.body.data).toHaveProperty('total_amount', 87.97); // (25.99 * 2) + 35.99

    // Store the actual cart item IDs for later tests
    const item1 = response.body.data.items.find((item: any) => item.product_id === productId1);
    const item2 = response.body.data.items.find((item: any) => item.product_id === productId2);
    if (item1) cartItemId1 = item1.id;
    if (item2) cartItemId2 = item2.id;
  });

  it('should update cart item quantity', async () => {
    // First add an item to cart
    const cartItem = {
      product_id: productId1,
      quantity: 2
    };

    const addResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem)
      .expect(201);

    // Get the cart item ID
    const addedItem = addResponse.body.data.items.find((item: any) => item.product_id === productId1);
    const itemId = addedItem.id;

    const updateData = {
      quantity: 3
    };

    const response = await request(app)
      .put(`/api/v1/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    const updatedItem = response.body.data.items.find((item: any) => item.id === itemId);
    expect(updatedItem).toHaveProperty('id', itemId);
    expect(updatedItem).toHaveProperty('quantity', 3);
  });

  it('should recalculate total after quantity update', async () => {
    // Add items to cart
    const cartItem1 = {
      product_id: productId1,
      quantity: 3
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

    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data).toHaveProperty('total_amount');
    expect(parseFloat(response.body.data.total_amount.toFixed(2))).toBe(113.96); // (25.99 * 3) + 35.99
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

    expect(response.body.data).toHaveProperty('items');
    expect(response.body.data.items.length).toBe(0);
    expect(response.body.data).toHaveProperty('total_amount', 0);
  });

  it('should remove item from shopping cart', async () => {
    // Add items to cart first
    const cartItem1 = {
      product_id: productId1,
      quantity: 3
    };

    const cartItem2 = {
      product_id: productId2,
      quantity: 1
    };

    const response1 = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem1)
      .expect(201);

    const response2 = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem2)
      .expect(201);

    // Get the cart item ID to remove
    const addedItem = response2.body.data.items.find((item: any) => item.product_id === productId2);

    if (!addedItem) {
      throw new Error('Could not find cart item to remove');
    }
    const itemId = addedItem.id;

    await request(app)
      .delete(`/api/v1/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);

    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data).toHaveProperty('items');
    expect(response.body.data.items.length).toBe(1);
    expect(response.body.data).toHaveProperty('total_amount', 77.97); // 25.99 * 3
  });

  it('should handle removal of non-existent cart item', async () => {
    await request(app)
      .delete('/api/v1/cart/items/nonexistentitemid') // Use format that passes validation
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
    // Add an item first
    const cartItem = {
      product_id: productId1,
      quantity: 2
    };

    const addResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(cartItem)
      .expect(201);

    // Get the cart item ID
    const addedItem = addResponse.body.data.items.find((item: any) => item.product_id === productId1);
    const itemId = addedItem.id;

    // Try to update quantity to zero
    await request(app)
      .put(`/api/v1/cart/items/${itemId}`)
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