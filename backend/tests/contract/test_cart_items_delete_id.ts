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

describe('DELETE /cart/items/{id}', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;
  let cartItemIdToDelete: string;
  let cartItemIdToKeep: string;

  beforeEach(async () => {
    // Create regular user using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const userResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('cart-delete'),
      password_hash: hashedPassword,
      first_name: 'John',
      last_name: 'Doe',
      is_verified: true
    });
    authToken = userResult.token;

    // Create admin user using test utilities
    const adminResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('admin-cart-delete'),
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      is_verified: true,
      role: 'ADMIN'
    });
    adminAuthToken = adminResult.token;

    // Create test product using test utilities
    const productData = {
      name: 'Test Product for Cart Delete',
      description: 'A test product for cart item deletion',
      price: 69.99,
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('CART-DELETE'),
      category: 'electronics'
    };

    productId = (await testUtils.createProduct(productData)).id;

    // Add items to cart for testing
    const firstItemData = {
      product_id: productId,
      quantity: 2
    };

    const firstItemResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(firstItemData);

    // Ensure the response has the expected structure before accessing items
    if (firstItemResponse.status !== 201 || !firstItemResponse.body.data || !firstItemResponse.body.data.items || firstItemResponse.body.data.items.length === 0) {
      throw new Error(`Failed to add first item to cart in beforeEach. Status: ${firstItemResponse.status}, Body: ${JSON.stringify(firstItemResponse.body)}`);
    }
    cartItemIdToDelete = firstItemResponse.body.data.items[0].id;

    const secondItemData = {
      product_id: productId,
      quantity: 1
    };

    const secondItemResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(secondItemData);

    // Ensure the response has the expected structure before accessing items
    if (secondItemResponse.status !== 201 || !secondItemResponse.body.data || !secondItemResponse.body.data.items || secondItemResponse.body.data.items.length === 0) {
      throw new Error(`Failed to add second item to cart in beforeEach. Status: ${secondItemResponse.status}, Body: ${JSON.stringify(secondItemResponse.body)}`);
    }
    cartItemIdToKeep = secondItemResponse.body.data.items[0].id;
  });

  it('should delete cart item successfully', async () => {
    // First verify the item exists in cart
    const cartBeforeDelete = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cartBeforeDelete.body.data.items.some((item: any) => item.id === cartItemIdToDelete)).toBe(true);

    // Delete the cart item
    await request(app)
      .delete(`/api/v1/cart/items/${cartItemIdToDelete}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);

    // Verify the item is no longer in cart
    const cartAfterDelete = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cartAfterDelete.body.data.items.some((item: any) => item.id === cartItemIdToDelete)).toBe(false);
  });

  it('should return 401 when no authentication token provided', async () => {
    await request(app)
      .delete(`/api/v1/cart/items/${cartItemIdToKeep}`)
      .expect(401);
  });

  it('should return 401 for invalid authentication token', async () => {
    await request(app)
      .delete(`/api/v1/cart/items/${cartItemIdToKeep}`)
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('should return 404 for non-existent cart item', async () => {
    const nonExistentItemId = '00000000-0000-0000-0000-000000000000';

    await request(app)
      .delete(`/api/v1/cart/items/${nonExistentItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should return 400 for invalid cart item UUID format', async () => {
    const invalidItemId = 'not-a-valid-uuid';

    await request(app)
      .delete(`/api/v1/cart/items/${invalidItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });

  it('should return 204 with empty response body on successful deletion', async () => {
    // Create a new cart item specifically for this test
    const newItemData = {
      product_id: productId,
      quantity: 1
    };

    const createResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(newItemData);

    const tempCartItemId = createResponse.body.data.items[0].id;

    // Delete the cart item
    const response = await request(app)
      .delete(`/api/v1/cart/items/${tempCartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);

    // Verify response body is empty
    expect(response.body).toEqual({});
  });

  it('should handle deletion of already deleted item', async () => {
    // Create a new item specifically for this test
    const newItemData = {
      product_id: productId,
      quantity: 1
    };

    const createResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(newItemData);

    const tempCartItemId = createResponse.body.data.items[0].id;

    // Delete the item first time
    await request(app)
      .delete(`/api/v1/cart/items/${tempCartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);

    // Try to delete the same item again
    await request(app)
      .delete(`/api/v1/cart/items/${tempCartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should not affect other cart items when deleting one', async () => {
    // Verify the item we intended to keep still exists
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.items.some((item: any) => item.id === cartItemIdToKeep)).toBe(true);
  });

  it('should update cart totals correctly after item deletion', async () => {
    // Create a new user for this test to avoid conflicts
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const testUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('cart-delete-totals'),
      password_hash: hashedPassword,
      first_name: 'Test',
      last_name: 'User',
      is_verified: true
    });
    const testAuthToken = testUserResult.token;

    // Get cart totals before adding the item (should be empty)
    const cartBeforeAdd = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .expect(200);

    const beforeTotalItems = cartBeforeAdd.body.data.total_items;
    const beforeTotalAmount = cartBeforeAdd.body.data.total_amount;

    // Verify cart is initially empty
    expect(beforeTotalItems).toBe(0);
    expect(beforeTotalAmount).toBe(0);

    // Create a fresh product for this test to avoid stock issues
    const freshProductData = {
      name: 'Cart Delete Totals Product',
      description: 'Product for cart delete totals testing',
      price: 29.99,
      stock_quantity: 100,
      sku: testUtils.generateUniqueSKU('CART-DELETE-TOTALS'),
      category: 'books'
    };

    const freshProductId = (await testUtils.createProduct(freshProductData)).id;

    // Create a new item to delete
    const newItemData = {
      product_id: freshProductId,
      quantity: 3
    };

    const createResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .send(newItemData);

    // Ensure the response has the expected structure before accessing items
    if (createResponse.status !== 201 || !createResponse.body.data || !createResponse.body.data.items || createResponse.body.data.items.length === 0) {
      throw new Error('Failed to add item to cart in update totals test');
    }
    const tempCartItemId = createResponse.body.data.items[0].id;

    // Get cart after adding item
    const cartAfterAdd = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .expect(200);

    const afterAddTotalItems = cartAfterAdd.body.data.total_items;
    const afterAddTotalAmount = cartAfterAdd.body.data.total_amount;

    // Verify the item was added
    expect(afterAddTotalItems).toBe(3);
    expect(afterAddTotalAmount).toBeGreaterThan(0);

    // Delete the item
    await request(app)
      .delete(`/api/v1/cart/items/${tempCartItemId}`)
      .set('Authorization', `Bearer ${testAuthToken}`)
      .expect(204);

    // Get cart after deletion
    const cartAfterDelete = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${testAuthToken}`)
      .expect(200);

    const afterDeleteTotalItems = cartAfterDelete.body.data.total_items;
    const afterDeleteTotalAmount = cartAfterDelete.body.data.total_amount;

    // Verify totals returned to original values (empty)
    expect(afterDeleteTotalItems).toBe(0);
    expect(afterDeleteTotalAmount).toBe(0);
  });

  it('should handle deletion of last item in cart (empty cart)', async () => {
    // Create a new user with only one cart item
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const newUserResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('single-item-user'),
      password_hash: hashedPassword,
      first_name: 'Single',
      last_name: 'User',
      is_verified: true
    });
    const newUserAuthToken = newUserResult.token;

    // Add single item to cart
    const singleItemData = {
      product_id: productId,
      quantity: 1
    };

    const singleItemResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${newUserAuthToken}`)
      .send(singleItemData);

    // Ensure the response has the expected structure before accessing items
    if (singleItemResponse.status !== 201 || !singleItemResponse.body.data || !singleItemResponse.body.data.items || singleItemResponse.body.data.items.length === 0) {
      throw new Error('Failed to add single item to cart in empty cart test');
    }
    const singleCartItemId = singleItemResponse.body.data.items[0].id;

    // Verify cart has one item
    const cartBeforeDelete = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${newUserAuthToken}`)
      .expect(200);

    expect(cartBeforeDelete.body.data.items).toHaveLength(1);
    expect(cartBeforeDelete.body.data.total_items).toBe(1);

    // Delete the last item
    await request(app)
      .delete(`/api/v1/cart/items/${singleCartItemId}`)
      .set('Authorization', `Bearer ${newUserAuthToken}`)
      .expect(204);

    // Verify cart is empty but still exists
    const cartAfterDelete = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${newUserAuthToken}`)
      .expect(200);

    expect(cartAfterDelete.body.data.items).toHaveLength(0);
    expect(cartAfterDelete.body.data.total_items).toBe(0);
    expect(cartAfterDelete.body.data.total_amount).toBe(0);
    expect(cartAfterDelete.body.data).toHaveProperty('id'); // Cart should still exist
  });

  it('should handle malformed cart item ID correctly', async () => {
    const malformedId = '123e4567-e89b-12d3-a456-42661417400'; // Missing last character

    await request(app)
      .delete(`/api/v1/cart/items/${malformedId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });
});