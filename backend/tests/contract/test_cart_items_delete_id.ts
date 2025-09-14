import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('DELETE /cart/items/{id}', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;
  let cartItemIdToDelete: string;
  let cartItemIdToKeep: string;

  beforeAll(async () => {
    // Create regular user
    const userData = {
      email: 'cart-delete-test@example.com',
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
      email: 'admin-cart-delete@example.com',
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
      name: 'Test Product for Cart Delete',
      description: 'A test product for cart item deletion',
      price: 69.99,
      stock_quantity: 100,
      sku: 'CART-DELETE-001',
      category: 'electronics'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData);

    productId = createResponse.body.id;

    // Add items to cart for testing
    const firstItemData = {
      product_id: productId,
      quantity: 2
    };

    const firstItemResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(firstItemData);

    cartItemIdToDelete = firstItemResponse.body.id;

    const secondItemData = {
      product_id: productId,
      quantity: 1
    };

    const secondItemResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(secondItemData);

    cartItemIdToKeep = secondItemResponse.body.id;
  });

  it('should delete cart item successfully', async () => {
    // First verify the item exists in cart
    const cartBeforeDelete = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cartBeforeDelete.body.items.some((item: any) => item.id === cartItemIdToDelete)).toBe(true);

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

    expect(cartAfterDelete.body.items.some((item: any) => item.id === cartItemIdToDelete)).toBe(false);
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

    const tempCartItemId = createResponse.body.id;

    // Delete the cart item
    const response = await request(app)
      .delete(`/api/v1/cart/items/${tempCartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);

    // Verify response body is empty
    expect(response.body).toEqual({});
  });

  it('should handle deletion of already deleted item', async () => {
    // Try to delete the same item again
    await request(app)
      .delete(`/api/v1/cart/items/${cartItemIdToDelete}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });

  it('should not affect other cart items when deleting one', async () => {
    // Verify the item we intended to keep still exists
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.items.some((item: any) => item.id === cartItemIdToKeep)).toBe(true);
  });

  it('should update cart totals correctly after item deletion', async () => {
    // Get cart totals before deletion
    const cartBeforeDelete = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const beforeTotalItems = cartBeforeDelete.body.total_items;
    const beforeTotalAmount = cartBeforeDelete.body.total_amount;

    // Create a new item to delete
    const newItemData = {
      product_id: productId,
      quantity: 3
    };

    const createResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send(newItemData);

    const tempCartItemId = createResponse.body.id;

    // Get cart after adding item
    const cartAfterAdd = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const afterAddTotalItems = cartAfterAdd.body.total_items;
    const afterAddTotalAmount = cartAfterAdd.body.total_amount;

    // Delete the item
    await request(app)
      .delete(`/api/v1/cart/items/${tempCartItemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);

    // Get cart after deletion
    const cartAfterDelete = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const afterDeleteTotalItems = cartAfterDelete.body.total_items;
    const afterDeleteTotalAmount = cartAfterDelete.body.total_amount;

    // Verify totals returned to original values
    expect(afterDeleteTotalItems).toBe(beforeTotalItems);
    expect(afterDeleteTotalAmount).toBe(beforeTotalAmount);
  });

  it('should handle deletion of last item in cart (empty cart)', async () => {
    // Create a new user with only one cart item
    const newUserData = {
      email: 'single-item-user@example.com',
      password: 'Password123!',
      first_name: 'Single',
      last_name: 'User'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(newUserData);

    const newUserLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: newUserData.email,
        password: newUserData.password
      });

    const newUserAuthToken = newUserLoginResponse.body.token;

    // Add single item to cart
    const singleItemData = {
      product_id: productId,
      quantity: 1
    };

    const singleItemResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${newUserAuthToken}`)
      .send(singleItemData);

    const singleCartItemId = singleItemResponse.body.id;

    // Verify cart has one item
    const cartBeforeDelete = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${newUserAuthToken}`)
      .expect(200);

    expect(cartBeforeDelete.body.items).toHaveLength(1);
    expect(cartBeforeDelete.body.total_items).toBe(1);

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

    expect(cartAfterDelete.body.items).toHaveLength(0);
    expect(cartAfterDelete.body.total_items).toBe(0);
    expect(cartAfterDelete.body.total_amount).toBe(0);
    expect(cartAfterDelete.body).toHaveProperty('id'); // Cart should still exist
  });

  it('should handle malformed cart item ID correctly', async () => {
    const malformedId = '123e4567-e89b-12d3-a456-42661417400'; // Missing last character

    await request(app)
      .delete(`/api/v1/cart/items/${malformedId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });
});