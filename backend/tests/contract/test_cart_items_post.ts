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

describe('POST /cart/items', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;
  let lowStockProductId: string;

  beforeEach(async () => {
    // Create regular user using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const userResult = await global.testUtils.createTestUserWithToken({
      email: global.testUtils.generateUniqueEmail('cart-items-post'),
      password_hash: hashedPassword,
      first_name: 'John',
      last_name: 'Doe',
      is_verified: true
    });
    authToken = userResult.token;

    // Create admin user using test utilities
    const adminResult = await global.testUtils.createTestUserWithToken({
      email: global.testUtils.generateUniqueEmail('admin-cart-items-post'),
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      is_verified: true,
      role: 'ADMIN'
    });
    adminAuthToken = adminResult.token;

    // Create test products using test utilities
    const productData = {
      name: 'Test Product for Cart Items',
      description: 'A test product for cart item operations',
      price: 79.99,
      stock_quantity: 100,
      sku: global.testUtils.generateUniqueSKU('CART-ITEMS'),
      category: 'electronics'
    };

    productId = (await global.testUtils.createProduct(productData)).id;

    // Create a product with low stock for testing insufficient stock scenarios
    const lowStockProductData = {
      name: 'Low Stock Product',
      description: 'Product with limited stock',
      price: 29.99,
      stock_quantity: 5,
      sku: global.testUtils.generateUniqueSKU('LOW-STOCK'),
      category: 'books'
    };

    lowStockProductId = (await global.testUtils.createProduct(lowStockProductData)).id;
  });

  it('should add item to cart successfully', async () => {
    const itemData = {
      product_id: productId,
      quantity: 2
    };

    const response = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(201);

    expect(response.body.data).toHaveProperty('items');
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toHaveProperty('id');
    expect(response.body.data.items[0]).toHaveProperty('product_id', productId);
    expect(response.body.data.items[0]).toHaveProperty('quantity', itemData.quantity);
    expect(response.body.data.items[0]).toHaveProperty('price_at_time', 79.99);
    expect(response.body.data.items[0]).toHaveProperty('created_at');
    expect(response.body.data.items[0]).toHaveProperty('product');
    expect(response.body.data.items[0].product).toHaveProperty('id', productId);
    expect(response.body.data.items[0].product).toHaveProperty('name', 'Test Product for Cart Items');
  });

  it('should return 401 when no authentication token provided', async () => {
    const itemData = {
      product_id: productId,
      quantity: 1
    };

    await request(app)
      .post('/api/v1/cart/items')
      .send(itemData)
      .expect(401);
  });

  it('should return 400 for missing required fields', async () => {
    const itemData = {
      // Missing product_id and quantity
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(400);
  });

  it('should return 400 for missing product_id', async () => {
    const itemData = {
      quantity: 1
      // Missing product_id
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(400);
  });

  it('should return 400 for missing quantity', async () => {
    const itemData = {
      product_id: productId
      // Missing quantity
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(400);
  });

  it('should return 400 for invalid quantity (too low)', async () => {
    const itemData = {
      product_id: productId,
      quantity: 0 // Below minimum of 1
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(400);
  });

  it('should return 400 for invalid quantity (too high)', async () => {
    const itemData = {
      product_id: productId,
      quantity: 101 // Above maximum of 100
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(400);
  });

  it('should return 400 for non-integer quantity', async () => {
    const itemData = {
      product_id: productId,
      quantity: 2.5 // Should be integer
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(400);
  });

  it('should return 400 for negative quantity', async () => {
    const itemData = {
      product_id: productId,
      quantity: -1
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(400);
  });

  it('should return 404 for non-existent product', async () => {
    const nonExistentProductId = '00000000-0000-0000-0000-000000000000';
    const itemData = {
      product_id: nonExistentProductId,
      quantity: 1
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(404);
  });

  it('should return 400 for invalid product UUID format', async () => {
    const itemData = {
      product_id: 'not-a-valid-uuid',
      quantity: 1
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(400);
  });

  it('should return 400 for insufficient stock', async () => {
    const itemData = {
      product_id: lowStockProductId,
      quantity: 10 // Requesting more than available stock (5)
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(400);
  });

  it('should allow adding item with exact available stock', async () => {
    const itemData = {
      product_id: lowStockProductId,
      quantity: 5 // Exactly the available stock
    };

    const response = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(201);

    expect(response.body.data.items[0]).toHaveProperty('quantity', 5);
  });

  it('should handle adding same product multiple times (update quantity)', async () => {
    // Add product first time
    const firstItemData = {
      product_id: productId,
      quantity: 1
    };

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(firstItemData)
      .expect(201);

    // Add same product again (should update quantity)
    const secondItemData = {
      product_id: productId,
      quantity: 3
    };

    const response = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(secondItemData)
      .expect(201);

    // Should have total quantity of 4 (1 + 3)
    expect(response.body.data.items[0]).toHaveProperty('quantity', 4);
  });

  it('should return consistent cart item structure', async () => {
    const itemData = {
      product_id: productId,
      quantity: 1
    };

    const response = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(201);

    const cartItem = response.body.data.items[0];

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

  it('should capture price at time of adding to cart', async () => {
    // This test ensures the price is locked when item is added to cart
    const itemData = {
      product_id: productId,
      quantity: 1
    };

    const response = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(itemData)
      .expect(201);

    expect(response.body.data.items[0]).toHaveProperty('price_at_time', 79.99);
  });
});