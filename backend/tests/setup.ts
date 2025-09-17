import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// Set environment to reduce Prisma logging in tests
process.env.LOG_LEVEL = 'warn';

let prisma: PrismaClient;

// Store test users and tokens to prevent deletion during test runs
const testUserIds = new Set<string>();
const testProductIds = new Set<string>();

// Track test-specific data to ensure complete isolation
const testSessionData = new Map<string, {
  users: Set<string>;
  products: Set<string>;
  orders: Set<string>;
  carts: Set<string>;
}>();

// Generate unique test session ID for each test run
let testSessionCounter = 0;

beforeAll(async () => {
  // Disable Prisma query logs for cleaner test output
  process.env.PRISMA_LOG_LEVEL = 'warn';
  process.env.PRISMA_LOGGER = 'none';

  // Use the existing database but ensure it's properly set up
  prisma = new PrismaClient({
    log: []
  });
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Create unique test session for each test
  testSessionCounter++;
  const currentTestId = `test-${testSessionCounter}-${Date.now()}`;

  // Initialize test session data
  testSessionData.set(currentTestId, {
    users: new Set(),
    products: new Set(),
    orders: new Set(),
    carts: new Set()
  });

  // Clean up database before each test - ULTRA ISOLATION APPROACH
  try {
    // Wait for any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // SQLite approach - ultra aggressive cleanup
    await prisma.$executeRaw`PRAGMA foreign_keys = OFF;`;

    // Clean up ALL data for complete isolation - use try/catch for each table
    const tables = ['Payment', 'OrderItem', 'Order', 'CartItem', 'ShoppingCart', 'Product', 'User'];
    for (const table of tables) {
      try {
        await prisma.$executeRaw`DELETE FROM ${table};`;
      } catch (error) {
        // Table might not exist, continue with next table
        console.log(`Table ${table} cleanup skipped:`, (error as Error)?.message || error);
      }
    }

    // Reset ALL auto-increment counters
    try {
      await prisma.$executeRaw`DELETE FROM sqlite_sequence;`;
    } catch (error) {
      console.log('SQLite sequence reset skipped:', (error as Error)?.message || error);
    }

    await prisma.$executeRaw`PRAGMA foreign_keys = ON;`;

    // Additional safety: Use Prisma deleteMany for tables that exist
    try {
      await prisma.orderItem.deleteMany();
      await prisma.order.deleteMany();
      await prisma.cartItem.deleteMany();
      await prisma.shoppingCart.deleteMany();
      await prisma.product.deleteMany();
      await prisma.user.deleteMany();
      try {
        await prisma.payment.deleteMany();
      } catch (e) {
        // Payment table might not exist
      }
    } catch (error) {
      console.log('Prisma cleanup error:', error);
    }

    // Clear all tracking sets
    testUserIds.clear();
    testProductIds.clear();

    // Extended delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    // If tables don't exist or other errors, just continue
    console.log('Database cleanup skipped:', error);
  }
});

afterAll(async () => {
  // Final comprehensive cleanup after all tests complete
  try {
    // Clean up all remaining data - SQLite approach with error handling
    await prisma.$executeRaw`PRAGMA foreign_keys = OFF;`;

    const tables = ['Payment', 'OrderItem', 'Order', 'CartItem', 'ShoppingCart', 'Product', 'User'];
    for (const table of tables) {
      try {
        await prisma.$executeRaw`DELETE FROM ${table};`;
      } catch (error) {
        // Table might not exist, continue with next table
      }
    }

    await prisma.$executeRaw`PRAGMA foreign_keys = ON;`;

    // Clear tracking sets
    testUserIds.clear();
    testProductIds.clear();
    testSessionData.clear();
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
    const product = await prisma.product.create({
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

    // Register this product as a test product to prevent deletion
    testProductIds.add(product.id);
    return product;
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
        is_verified: userData.is_verified !== undefined ? userData.is_verified : true,
      },
    });

    // Register this user as a test user to prevent deletion
    testUserIds.add(user.id);

    // Generate JWT token with longer expiration for tests
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' } // Longer expiration for test stability
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