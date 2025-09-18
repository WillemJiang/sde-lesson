import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';
import bcrypt from 'bcryptjs';

// Test utilities are already declared globally in setup.ts
declare global {
  var testUtils: {
    createUser: (userData: any) => Promise<any>;
    createProduct: (productData: any) => Promise<any>;
    generateUniqueEmail: (prefix: string) => string;
    generateUniqueSKU: (prefix: string) => string;
    createTestUserWithToken: (userData: any) => Promise<{ user: any; token: string }>;
    validateToken: (token: string) => any;
    protectUser: (userId: string) => void;
  };
}

describe('PUT /cart/items/{id}', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;
  let lowStockProductId: string;
  let cartItemId: string;

  beforeEach(async () => {
    // Create regular user using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const userResult = await global.testUtils.createTestUserWithToken({
      email: global.testUtils.generateUniqueEmail('cart-update'),
      password_hash: hashedPassword,
      first_name: 'John',
      last_name: 'Doe',
      is_verified: true
    });
    authToken = userResult.token;

    // Protect this user from cleanup to prevent authentication issues
    global.testUtils.protectUser(userResult.user.id);

    // Create admin user using test utilities
    const adminResult = await global.testUtils.createTestUserWithToken({
      email: global.testUtils.generateUniqueEmail('admin-cart-update'),
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      is_verified: true,
      role: 'ADMIN'
    });
    adminAuthToken = adminResult.token;

    // Protect this admin user from cleanup to prevent authentication issues
    global.testUtils.protectUser(adminResult.user.id);

    // Create test product through API (admin required)
    const productData = {
      name: 'Test Product for Cart Update',
      description: 'A test product for cart item update operations',
      price: 89.99,
      stock_quantity: 50,
      sku: global.testUtils.generateUniqueSKU('CART-UPDATE'),
      category: 'electronics'
    };

    productId = (await global.testUtils.createProduct(productData)).id;

    // Create a product with low stock
    const lowStockProductData = {
      name: 'Low Stock Product for Update',
      description: 'Product with limited stock for update testing',
      price: 39.99,
      stock_quantity: 8,
      sku: global.testUtils.generateUniqueSKU('LOW-STOCK-UPDATE'),
      category: 'books'
    };

    lowStockProductId = (await global.testUtils.createProduct(lowStockProductData)).id;

    // Add an item to cart to get a cart item ID for testing
    const addItemData = {
      product_id: productId,
      quantity: 2
    };

    const addItemResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(addItemData);

    // Validate the cart item creation succeeded
    if (addItemResponse.status !== 201 || !addItemResponse.body.data || !addItemResponse.body.data.items || addItemResponse.body.data.items.length === 0) {
      throw new Error(`Failed to create cart item for testing. Status: ${addItemResponse.status}, Body: ${JSON.stringify(addItemResponse.body)}`);
    }

    cartItemId = addItemResponse.body.data.items[0].id;
  });

  it('should update cart item quantity successfully', async () => {
    const updateData = {
      quantity: 5
    };

    const response = await request(app)
      .put(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    expect(response.body.data).toHaveProperty('items');
    const updatedItem = response.body.data.items.find((item: any) => item.id === cartItemId);
    expect(updatedItem).toHaveProperty('id', cartItemId);
    expect(updatedItem).toHaveProperty('quantity', updateData.quantity);
    expect(updatedItem).toHaveProperty('product_id', productId);
    expect(updatedItem).toHaveProperty('price_at_time', 89.99);
    expect(updatedItem).toHaveProperty('product');
    expect(updatedItem.product).toHaveProperty('id', productId);
  });

  it('should return 401 when no authentication token provided', async () => {
    const updateData = {
      quantity: 3
    };

    await request(app)
      .put(`/api/v1/cart/items/${cartItemId}`)
      .send(updateData)
      .expect(401);
  });

  it('should return 400 for missing required fields', async () => {
    const updateData = {}; // Missing quantity

    await request(app)
      .put(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for invalid quantity (too low)', async () => {
    const updateData = {
      quantity: 0 // Below minimum of 1
    };

    await request(app)
      .put(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for invalid quantity (too high)', async () => {
    const updateData = {
      quantity: 101 // Above maximum of 100
    };

    await request(app)
      .put(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for negative quantity', async () => {
    const updateData = {
      quantity: -1
    };

    await request(app)
      .put(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for non-integer quantity', async () => {
    const updateData = {
      quantity: 2.5 // Should be integer
    };

    await request(app)
      .put(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 404 for non-existent cart item', async () => {
    const nonExistentItemId = '00000000-0000-0000-0000-000000000000';
    const updateData = {
      quantity: 3
    };

    await request(app)
      .put(`/api/v1/cart/items/${nonExistentItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(404);
  });

  it('should return 400 for invalid cart item UUID format', async () => {
    const invalidItemId = 'not-a-valid-uuid';
    const updateData = {
      quantity: 3
    };

    await request(app)
      .put(`/api/v1/cart/items/${invalidItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should return 400 for insufficient stock when increasing quantity', async () => {
    // First add a low stock item to cart
    const addItemData = {
      product_id: lowStockProductId,
      quantity: 3
    };

    const addItemResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(addItemData);

    const lowStockCartItemId = addItemResponse.body.data.items.find((item: any) => item.product_id === lowStockProductId).id;

    // Try to update to quantity that exceeds available stock
    const updateData = {
      quantity: 10 // Total stock available is 8, already have 3, so max we can add is 5 more
    };

    await request(app)
      .put(`/api/v1/cart/items/${lowStockCartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(400);
  });

  it('should allow updating to exact available stock', async () => {
    // Add another low stock item
    const addItemData = {
      product_id: lowStockProductId,
      quantity: 2
    };

    const addItemResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(addItemData);

    const lowStockCartItemId = addItemResponse.body.data.items.find((item: any) => item.product_id === lowStockProductId).id;

    // Update to exactly the remaining stock (8 - 3 - 2 = 3 remaining)
    const updateData = {
      quantity: 3 // New total will be 6 (3 + 3), within available stock
    };

    const response = await request(app)
      .put(`/api/v1/cart/items/${lowStockCartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    const updatedItem = response.body.data.items.find((item: any) => item.id === lowStockCartItemId);
    expect(updatedItem).toHaveProperty('quantity', 3);
  });

  it('should allow decreasing quantity', async () => {
    const updateData = {
      quantity: 1 // Decrease from current quantity
    };

    const response = await request(app)
      .put(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    const updatedItem = response.body.data.items.find((item: any) => item.id === cartItemId);
    expect(updatedItem).toHaveProperty('quantity', 1);
  });

  it('should maintain original price when updating quantity', async () => {
    // Get current cart item to verify price
    const currentResponse = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const cartItem = currentResponse.body.data.items.find((item: any) => item.id === cartItemId);
    const originalPrice = cartItem.price_at_time;

    const updateData = {
      quantity: 4
    };

    const response = await request(app)
      .put(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    const updatedItem = response.body.data.items.find((item: any) => item.id === cartItemId);
    expect(updatedItem).toHaveProperty('price_at_time', originalPrice);
  });

  it('should return consistent cart item structure after update', async () => {
    const updateData = {
      quantity: 2
    };

    const response = await request(app)
      .put(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    const cartItem = response.body.data.items.find((item: any) => item.id === cartItemId);

    // Verify all expected fields are present and have correct types
    expect(typeof cartItem.id).toBe('string');
    expect(typeof cartItem.product_id).toBe('string');
    expect(typeof cartItem.quantity).toBe('number');
    expect(typeof cartItem.price_at_time).toBe('number');
    expect(typeof cartItem.created_at).toBe('string');
    expect(typeof cartItem.product).toBe('object');

    // Verify numeric constraints
    expect(cartItem.quantity).toBeGreaterThan(0);
    expect(cartItem.price_at_time).toBeGreaterThan(0);
  });

  it('should handle update with same quantity (no-op)', async () => {
    // Get current quantity
    const currentResponse = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const cartItem = currentResponse.body.data.items.find((item: any) => item.id === cartItemId);
    const currentQuantity = cartItem.quantity;

    const updateData = {
      quantity: currentQuantity // Same quantity
    };

    const response = await request(app)
      .put(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect(200);

    const updatedItem = response.body.data.items.find((item: any) => item.id === cartItemId);
    expect(updatedItem).toHaveProperty('quantity', currentQuantity);
  });
});