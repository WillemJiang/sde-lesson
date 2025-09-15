import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/index';

describe('DELETE /products/{id}', () => {
  let adminAuthToken: string;
  let userAuthToken: string;
  let productIdToDelete: string;
  let productIdToKeep: string;

  beforeAll(async () => {
    // Create admin user
    const adminData = {
      email: 'admin-delete@example.com',
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

    // Create regular user
    const userData = {
      email: 'regular-delete@example.com',
      password: 'Password123!',
      first_name: 'Regular',
      last_name: 'User'
    };

    await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    const userLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });

    userAuthToken = userLoginResponse.body.token;

    // Create test products
    const productToDeleteData = {
      name: 'Product to Delete',
      description: 'This product will be deleted',
      price: 29.99,
      stock_quantity: 50,
      sku: 'DELETE-TEST-001',
      category: 'electronics'
    };

    const createDeleteResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productToDeleteData);

    productIdToDelete = createDeleteResponse.body.data.id;

    const productToKeepData = {
      name: 'Product to Keep',
      description: 'This product will not be deleted',
      price: 39.99,
      stock_quantity: 25,
      sku: 'KEEP-TEST-001',
      category: 'books'
    };

    const createKeepResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productToKeepData);

    productIdToKeep = createKeepResponse.body.data.id;
  });

  it('should delete product successfully with admin privileges', async () => {
    // First verify the product exists
    await request(app)
      .get(`/api/v1/products/${productIdToDelete}`)
      .expect(200);

    // Delete the product
    await request(app)
      .delete(`/api/v1/products/${productIdToDelete}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(204);

    // Verify the product no longer exists
    await request(app)
      .get(`/api/v1/products/${productIdToDelete}`)
      .expect(404);
  });

  it('should return 403 when user is not admin', async () => {
    await request(app)
      .delete(`/api/v1/products/${productIdToKeep}`)
      .set('Authorization', `Bearer ${userAuthToken}`)
      .expect(403);
  });

  it('should return 401 when no authentication token provided', async () => {
    await request(app)
      .delete(`/api/v1/products/${productIdToKeep}`)
      .expect(401);
  });

  it('should return 404 for non-existent product ID', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    await request(app)
      .delete(`/api/v1/products/${nonExistentId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(404);
  });

  it('should return 400 for invalid UUID format', async () => {
    const invalidId = 'not-a-valid-uuid';

    await request(app)
      .delete(`/api/v1/products/${invalidId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(400);
  });

  it('should return 204 with empty response body on successful deletion', async () => {
    // Create a new product specifically for this test
    const productData = {
      name: 'Temporary Product for Deletion Test',
      description: 'This product will be deleted in this test',
      price: 19.99,
      stock_quantity: 10,
      sku: 'TEMP-DELETE-001',
      category: 'test'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData);

    const tempProductId = createResponse.body.data.id;

    // Delete the product
    const response = await request(app)
      .delete(`/api/v1/products/${tempProductId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(204);

    // Verify response body is empty (204 responses should have no body)
    expect(response.text).toBe('');
  });

  it('should handle deletion of already deleted product', async () => {
    // Try to delete the same product again
    await request(app)
      .delete(`/api/v1/products/${productIdToDelete}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(404);
  });

  it('should not affect other products when deleting one', async () => {
    // Verify the product we intended to keep still exists
    const response = await request(app)
      .get(`/api/v1/products/${productIdToKeep}`)
      .expect(200);

    expect(response.body.data).toHaveProperty('id', productIdToKeep);
    expect(response.body.data).toHaveProperty('name', 'Product to Keep');
  });

  it('should allow deletion of product with zero stock', async () => {
    // Create a product with zero stock
    const zeroStockProduct = {
      name: 'Zero Stock Product',
      description: 'Product with zero stock to be deleted',
      price: 9.99,
      stock_quantity: 0,
      sku: 'ZERO-STOCK-001',
      category: 'test'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(zeroStockProduct);

    const zeroStockProductId = createResponse.body.data.id;

    // Delete the product
    const deleteResponse = await request(app)
      .delete(`/api/v1/products/${zeroStockProductId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(204);

    // Verify response body is empty (204 responses should have no body)
    expect(deleteResponse.text).toBe('');

    // Verify it's deleted
    await request(app)
      .get(`/api/v1/products/${zeroStockProductId}`)
      .expect(404);
  });

  it('should handle malformed ID in path correctly', async () => {
    const malformedId = '123e4567-e89b-12d3-a456-42661417400'; // Missing last character

    await request(app)
      .delete(`/api/v1/products/${malformedId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .expect(400);
  });
});