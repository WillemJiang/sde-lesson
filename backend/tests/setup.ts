import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

let prisma: PrismaClient;

// Store test users and tokens to prevent deletion during test runs
const testUserIds = new Set<string>();

beforeAll(async () => {
  // Use the existing database but ensure it's properly set up
  prisma = new PrismaClient();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up database before each test, but preserve test users
  try {
    // Wait for any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Delete in reverse order to handle foreign key constraints
    // Start with dependent records
    await prisma.payment.deleteMany();
    await new Promise(resolve => setTimeout(resolve, 50));

    await prisma.orderItem.deleteMany();
    await new Promise(resolve => setTimeout(resolve, 50));

    await prisma.order.deleteMany();
    await new Promise(resolve => setTimeout(resolve, 50));

    await prisma.cartItem.deleteMany();
    await new Promise(resolve => setTimeout(resolve, 50));

    await prisma.shoppingCart.deleteMany();
    await new Promise(resolve => setTimeout(resolve, 50));

    await prisma.product.deleteMany();
    await new Promise(resolve => setTimeout(resolve, 50));

    // Only delete users that are not test users
    await prisma.user.deleteMany({
      where: {
        id: {
          notIn: Array.from(testUserIds)
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 50));

    // Final delay to ensure all cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 200));
  } catch (error) {
    // If tables don't exist or other errors, just continue
    console.log('Database cleanup skipped:', error);
  }
});

afterAll(async () => {
  // Clean up all test users after all tests complete
  try {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: Array.from(testUserIds)
        }
      }
    });
    testUserIds.clear();
  } catch (error) {
    console.log('Final cleanup failed:', error);
  }
});

// Global test utilities
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

// Generate unique identifiers for tests to prevent conflicts
let testCounter = 0;

global.testUtils = {
  createUser: async (userData: any) => {
    const user = await prisma.user.create({
      data: {
        email: userData.email || 'test@example.com',
        password_hash: userData.password_hash || 'hashedpassword',
        first_name: userData.first_name || 'Test',
        last_name: userData.last_name || 'User',
        is_verified: userData.is_verified || true,
      },
    });

    // Register this user as a test user to prevent deletion
    testUserIds.add(user.id);
    return user;
  },

  createProduct: async (productData: any) => {
    return await prisma.product.create({
      data: {
        name: productData.name || 'Test Product',
        description: productData.description || 'Test Description',
        price: productData.price || 10.99,
        stock_quantity: productData.stock_quantity || 100,
        sku: productData.sku || 'TEST-SKU',
        category: productData.category || 'Test Category',
        is_active: productData.is_active ?? true,
      },
    });
  },

  generateUniqueEmail: (prefix: string): string => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    testCounter++;
    return `${prefix}-${timestamp}-${random}-${testCounter}@example.com`;
  },

  generateUniqueSKU: (prefix: string): string => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    testCounter++;
    return `${prefix}-${timestamp}-${random}-${testCounter}`;
  },

  createTestUserWithToken: async (userData: any) => {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password_hash: userData.password_hash || 'hashedpassword',
        first_name: userData.first_name,
        last_name: userData.last_name,
        is_verified: true,
      },
    });

    // Register this user as a test user to prevent deletion
    testUserIds.add(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '1h' }
    );

    return { user, token };
  },

  validateToken: (token: string) => {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    } catch (error) {
      return null;
    }
  },
};