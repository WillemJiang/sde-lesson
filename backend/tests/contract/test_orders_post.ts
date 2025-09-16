import request from 'supertest';
import { describe, it, expect, beforeEach } from '@jest/globals';
import app from '../../src/index';

describe('POST /orders', () => {
  let authToken: string;
  let adminAuthToken: string;
  let productId: string;
  let unverifiedUserToken: string;

  beforeEach(async () => {
    // Create regular user with unique email
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const userData = {
      email: `order-create-test-${timestamp}-${randomSuffix}@example.com`,
      password: 'Password123!',
      first_name: 'John',
      last_name: 'Doe'
    };

    let authTokenResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData);

    // If user already exists, login instead
    if (authTokenResponse.status === 409) {
      authTokenResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });
    }

    authToken = authTokenResponse.body.token;

    // Create unverified user with unique email
    const unverifiedUserData = {
      email: `unverified-order-${timestamp}-${randomSuffix}@example.com`,
      password: 'Password123!',
      first_name: 'Jane',
      last_name: 'Doe'
    };

    let unverifiedTokenResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(unverifiedUserData);

    // If user already exists, login instead
    if (unverifiedTokenResponse.status === 409) {
      unverifiedTokenResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: unverifiedUserData.email,
          password: unverifiedUserData.password
        });
    }

    unverifiedUserToken = unverifiedTokenResponse.body.token;

    // Create admin user with unique email
    const adminData = {
      email: `admin-order-${timestamp}-${randomSuffix}@example.com`,
      password: 'Password123!',
      first_name: 'Admin',
      last_name: 'User'
    };

    let adminTokenResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(adminData);

    // If admin user already exists, login instead
    if (adminTokenResponse.status === 409) {
      adminTokenResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: adminData.email,
          password: adminData.password
        });
    }

    adminAuthToken = adminTokenResponse.body.token;

    // Create test product
    const productData = {
      name: 'Test Product for Order Creation',
      description: 'A test product for order creation testing',
      price: 159.99,
      stock_quantity: 50,
      sku: 'ORDER-CREATE-001',
      category: 'electronics'
    };

    const createResponse = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(productData);

    productId = createResponse.body.data.id;
  });

  it('should create order successfully with valid data', async () => {
    // Add items to cart first
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
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('user_id');
    expect(response.body).toHaveProperty('status', 'PENDING');
    expect(response.body).toHaveProperty('total_amount');
    expect(response.body).toHaveProperty('created_at');
    expect(response.body).toHaveProperty('updated_at');
    expect(response.body).toHaveProperty('items_count', 2);
    expect(typeof response.body.total_amount).toBe('number');
    expect(response.body.total_amount).toBeGreaterThan(0);
  });

  it('should return 401 when no authentication token provided', async () => {
    const orderData = {
      shipping_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .send(orderData)
      .expect(401);
  });

  it('should return 403 when user is not verified', async () => {
    const orderData = {
      shipping_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${unverifiedUserToken}`)
      .send(orderData)
      .expect(403);
  });

  it('should return 400 for missing required fields', async () => {
    const orderData = {
      // Missing shipping_address and billing_address
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should return 400 for missing shipping address', async () => {
    const orderData = {
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
      // Missing shipping_address
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should return 400 for missing billing address', async () => {
    const orderData = {
      shipping_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
      // Missing billing_address
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should return 400 for incomplete shipping address', async () => {
    const orderData = {
      shipping_address: {
        street: '123 Main St',
        city: 'New York'
        // Missing state, zip_code, country
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should return 400 for empty cart', async () => {
    // Create a new user with empty cart
    const newUserData = {
      email: 'empty-cart-user@example.com',
      password: 'Password123!',
      first_name: 'Empty',
      last_name: 'Cart'
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

    const orderData = {
      shipping_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${newUserAuthToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should calculate correct total amount from cart items', async () => {
    // Add specific items to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 3
      })
      .expect(201);

    // Get cart to verify total
    const cartResponse = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const expectedTotal = cartResponse.body.total_amount;

    const orderData = {
      shipping_address: {
        street: '456 Oak St',
        city: 'Boston',
        state: 'MA',
        zip_code: '02108',
        country: 'USA'
      },
      billing_address: {
        street: '456 Oak St',
        city: 'Boston',
        state: 'MA',
        zip_code: '02108',
        country: 'USA'
      }
    };

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    expect(response.body.total_amount).toBe(expectedTotal);
  });

  it('should handle different shipping and billing addresses', async () => {
    // Add item to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    const orderData = {
      shipping_address: {
        street: '789 Pine St',
        city: 'Los Angeles',
        state: 'CA',
        zip_code: '90210',
        country: 'USA'
      },
      billing_address: {
        street: '321 Elm St',
        city: 'Chicago',
        state: 'IL',
        zip_code: '60601',
        country: 'USA'
      }
    };

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.status).toBe('PENDING');
  });

  it('should return 400 for invalid address data', async () => {
    const orderData = {
      shipping_address: {
        street: '', // Empty street
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      },
      billing_address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(400);
  });

  it('should clear cart after successful order creation', async () => {
    // Verify cart has items before order creation
    const cartBeforeOrder = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cartBeforeOrder.body.total_items).toBeGreaterThan(0);

    // Create order
    const orderData = {
      shipping_address: {
        street: '555 Maple St',
        city: 'Seattle',
        state: 'WA',
        zip_code: '98101',
        country: 'USA'
      },
      billing_address: {
        street: '555 Maple St',
        city: 'Seattle',
        state: 'WA',
        zip_code: '98101',
        country: 'USA'
      }
    };

    await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    // Verify cart is empty after order creation
    const cartAfterOrder = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cartAfterOrder.body.total_items).toBe(0);
    expect(cartAfterOrder.body.total_amount).toBe(0);
  });

  it('should return consistent order structure', async () => {
    // Add item to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        product_id: productId,
        quantity: 1
      })
      .expect(201);

    const orderData = {
      shipping_address: {
        street: '999 Cedar St',
        city: 'Miami',
        state: 'FL',
        zip_code: '33101',
        country: 'USA'
      },
      billing_address: {
        street: '999 Cedar St',
        city: 'Miami',
        state: 'FL',
        zip_code: '33101',
        country: 'USA'
      }
    };

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send(orderData)
      .expect(201);

    const order = response.body;

    // Verify all expected fields are present and have correct types
    expect(typeof order.id).toBe('string');
    expect(typeof order.user_id).toBe('string');
    expect(typeof order.status).toBe('string');
    expect(typeof order.total_amount).toBe('number');
    expect(typeof order.created_at).toBe('string');
    expect(typeof order.updated_at).toBe('string');
    expect(typeof order.items_count).toBe('number');

    // Verify status is PENDING for new orders
    expect(order.status).toBe('PENDING');

    // Verify numeric constraints
    expect(order.total_amount).toBeGreaterThan(0);
    expect(order.items_count).toBeGreaterThan(0);
  });
});