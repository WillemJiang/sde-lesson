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

// Track cleanup state to prevent excessive cleaning
let cleanupCounter = 0;
const CLEANUP_INTERVAL = 50; // Clean up every 50 tests (much less frequent)

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

  // Much less frequent cleanup to prevent breaking authentication
  cleanupCounter++;
  if (cleanupCounter % CLEANUP_INTERVAL === 0) {
    await performPartialCleanup();
  }
});

// Partial cleanup that preserves recent test data
const performPartialCleanup = async () => {
  try {
    // Only clean up very old data (older than 1 minute) to prevent test interference
    const cutoffTime = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago

    await prisma.orderItem.deleteMany({
      where: {
        created_at: {
          lt: cutoffTime
        }
      }
    });

    await prisma.order.deleteMany({
      where: {
        created_at: {
          lt: cutoffTime
        }
      }
    });

    await prisma.cartItem.deleteMany({
      where: {
        created_at: {
          lt: cutoffTime
        }
      }
    });

    await prisma.shoppingCart.deleteMany({
      where: {
        created_at: {
          lt: cutoffTime
        }
      }
    });

    console.log(`Performed partial cleanup (test ${cleanupCounter}) - removed data older than 1 minute`);
  } catch (error) {
    console.log('Partial cleanup failed:', error);
  }
};

afterAll(async () => {
  // Final comprehensive cleanup after all tests complete
  try {
    // Use Prisma deleteMany for final cleanup - respects foreign key constraints
    try {
      // Delete payments first (depends on orders)
      try {
        await prisma.payment.deleteMany();
      } catch (e) {
        // Payment table might not exist
      }

      // Delete order items before orders
      await prisma.orderItem.deleteMany();
      await prisma.order.deleteMany();

      // Delete cart items before carts
      await prisma.cartItem.deleteMany();
      await prisma.shoppingCart.deleteMany();

      // Delete products and users
      await prisma.product.deleteMany();

      // Only delete users that are not in the protected testUserIds set
      if (testUserIds.size > 0) {
        await prisma.user.deleteMany({
          where: {
            id: {
              notIn: Array.from(testUserIds)
            }
          }
        });
      } else {
        await prisma.user.deleteMany();
      }
    } catch (error) {
      // Tables might not exist, continue
    }

    // Only clear product IDs and session data - keep test users protected across all test files
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
  var testUserIds: Set<string>;
}

// Generate unique identifiers for tests to prevent conflicts
let testCounter = 0;

// Expose testUserIds to global scope for test files to access
global.testUserIds = testUserIds;

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