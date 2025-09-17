import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';
import bcrypt from 'bcryptjs';

// Declare testUtils to make it available in this file
declare const testUtils: {
  generateUniqueEmail: (prefix: string) => string;
  generateUniqueSKU: (prefix: string) => string;
  createTestUserWithToken: (userData: any) => Promise<{ user: any; token: string }>;
  createProduct: (productData: any) => Promise<any>;
};

describe('DELETE /products/{id}', () => {
  let adminAuthToken: string;
  let userAuthToken: string;
  let productIdToDelete: string;
  let productIdToKeep: string;

  beforeEach(async () => {
    // Create admin user with preserved token using test utilities
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const adminResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('admin-delete-test'),
      password_hash: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      is_verified: true,
      role: 'ADMIN'
    });
    adminAuthToken = adminResult.token;

    // Create regular user with preserved token
    const userResult = await testUtils.createTestUserWithToken({
      email: testUtils.generateUniqueEmail('regular-delete-test'),
      password_hash: hashedPassword,
      first_name: 'Regular',
      last_name: 'User',
      is_verified: true
    });
    userAuthToken = userResult.token;

    // Create test products using test utilities
    const productToDeleteData = {
      name: 'Product to Delete',
      description: 'This product will be deleted',
      price: 29.99,
      stock_quantity: 50,
      sku: testUtils.generateUniqueSKU('DELETE-TEST'),
      category: 'electronics'
    };

    productIdToDelete = (await testUtils.createProduct(productToDeleteData)).id;

    const productToKeepData = {
      name: 'Product to Keep',
      description: 'This product will not be deleted',
      price: 39.99,
      stock_quantity: 25,
      sku: testUtils.generateUniqueSKU('KEEP-TEST'),
      category: 'books'
    };

    productIdToKeep = (await testUtils.createProduct(productToKeepData)).id;
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
    const nonExistentId = 'cm1234567890abcdef12345678'; // CUID format that doesn't exist

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
      .expect(204); // DELETE should be idempotent
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