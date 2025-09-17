import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

// Set environment to reduce Prisma logging in tests
process.env.LOG_LEVEL = 'warn';

let prisma: PrismaClient;

// File-based persistence for test user IDs across test files
const TEST_USERS_FILE = path.join(__dirname, 'test-users.json');
const testUserIds = new Set<string>();
const testProductIds = new Set<string>();

// Load protected user IDs from file
const loadProtectedUsers = () => {
  try {
    if (fs.existsSync(TEST_USERS_FILE)) {
      const data = fs.readFileSync(TEST_USERS_FILE, 'utf8');
      const userIds = JSON.parse(data);
      userIds.forEach((id: string) => testUserIds.add(id));
      console.log(`Loaded ${userIds.length} protected user IDs from file`);
    }
  } catch (error) {
    console.log('No protected users file found, starting fresh');
  }
};

// Save protected user IDs to file
const saveProtectedUsers = () => {
  try {
    const userIds = Array.from(testUserIds);
    fs.writeFileSync(TEST_USERS_FILE, JSON.stringify(userIds));
    console.log(`Saved ${userIds.length} protected user IDs to file`);
  } catch (error) {
    console.log('Failed to save protected users:', error);
  }
};

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

  // Load previously protected users
  loadProtectedUsers();
});

afterAll(async () => {
  await prisma.$disconnect();

  // Clean up the test users file
  try {
    if (fs.existsSync(TEST_USERS_FILE)) {
      fs.unlinkSync(TEST_USERS_FILE);
      console.log('Cleaned up protected users file');
    }
  } catch (error) {
    console.log('Failed to clean up protected users file:', error);
  }
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

  // Very conservative cleanup - only every 100 tests and only very old data
  cleanupCounter++;
  if (cleanupCounter % 100 === 0) {
    console.log(`Cleanup check at test ${cleanupCounter}, testUserIds size: ${(global as any).testUserIds?.size || 0}`);
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
    protectUser: (userId: string) => void;
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
    saveProtectedUsers(); // Save to file for persistence
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
    saveProtectedUsers(); // Save to file for persistence

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

  // Helper function to protect a user and save to persistent storage
  protectUser: (userId: string) => {
    testUserIds.add(userId);
    saveProtectedUsers();
  },
};