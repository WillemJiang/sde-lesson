import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

// Set environment to reduce Prisma logging in tests
process.env.LOG_LEVEL = 'warn';

let prisma: PrismaClient;

// File-based persistence for test user and product IDs across test files
const TEST_USERS_FILE = path.join(__dirname, 'test-users.json');
const TEST_PRODUCTS_FILE = path.join(__dirname, 'test-products.json');
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

// Load protected product IDs from file
const loadProtectedProducts = () => {
  try {
    if (fs.existsSync(TEST_PRODUCTS_FILE)) {
      const data = fs.readFileSync(TEST_PRODUCTS_FILE, 'utf8');
      const productIds = JSON.parse(data);
      productIds.forEach((id: string) => testProductIds.add(id));
      console.log(`Loaded ${productIds.length} protected product IDs from file`);
    }
  } catch (error) {
    console.log('No protected products file found, starting fresh');
  }
};

// Save protected product IDs to file
const saveProtectedProducts = () => {
  try {
    const productIds = Array.from(testProductIds);
    fs.writeFileSync(TEST_PRODUCTS_FILE, JSON.stringify(productIds));
    console.log(`Saved ${productIds.length} protected product IDs to file`);
  } catch (error) {
    console.log('Failed to save protected products:', error);
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
  
  try {
    await prisma.$connect();
  } catch (error) {
    // If connection fails, try to sync the schema
    console.log('Initial connection failed, attempting to sync schema...');
  }

  // Load previously protected users and products
  loadProtectedUsers();
  loadProtectedProducts();
});

afterAll(async () => {
  await prisma.$disconnect();

  // DO NOT delete the protected users file - it's needed across test suites
  // The file persists so that protected users from earlier test suites 
  // remain protected when later test suites run
});

// Track cleanup state to prevent excessive cleaning
let cleanupCounter = 0;
const CLEANUP_INTERVAL = 200; // Clean up every 200 tests (much less frequent)

beforeEach(async () => {
  // Reload protected users and products from file at the start of each test
  // This ensures we have all protected users and products from all test suites
  try {
    if (fs.existsSync(TEST_USERS_FILE)) {
      const data = fs.readFileSync(TEST_USERS_FILE, 'utf8');
      const userIds = JSON.parse(data);
      userIds.forEach((id: string) => testUserIds.add(id));
    }
  } catch (error) {
    // Ignore errors reading file
  }

  try {
    if (fs.existsSync(TEST_PRODUCTS_FILE)) {
      const data = fs.readFileSync(TEST_PRODUCTS_FILE, 'utf8');
      const productIds = JSON.parse(data);
      productIds.forEach((id: string) => testProductIds.add(id));
    }
  } catch (error) {
    // Ignore errors reading file
  }

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

  // NO CLEANUP DURING TEST EXECUTION - Only clean up after all tests complete
  // This prevents test interference and foreign key constraint violations
  cleanupCounter++;
  if (cleanupCounter % 500 === 0) {
    console.log(`Test progress: ${cleanupCounter} tests completed, testUserIds size: ${testUserIds.size}`);
  }
});

// Partial cleanup that preserves recent test data AND protected test users
const performPartialCleanup = async () => {
  try {
    // Only clean up very old data (older than 2 minutes) to prevent test interference
    const cutoffTime = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

    // Get all protected user IDs to ensure we don't break their relationships
    const protectedUserIds = Array.from(testUserIds);

    // Clean up order items for old data, excluding orders from protected users
    await prisma.orderItem.deleteMany({
      where: {
        created_at: {
          lt: cutoffTime
        },
        order: {
          user_id: {
            notIn: protectedUserIds
          }
        }
      }
    });

    // Clean up orders for old data, excluding protected users
    await prisma.order.deleteMany({
      where: {
        created_at: {
          lt: cutoffTime
        },
        user_id: {
          notIn: protectedUserIds
        }
      }
    });

    // Clean up cart items for old data, excluding protected users' carts
    await prisma.cartItem.deleteMany({
      where: {
        created_at: {
          lt: cutoffTime
        },
        cart: {
          user_id: {
            notIn: protectedUserIds
          }
        }
      }
    });

    // Clean up shopping carts for old data, excluding protected users
    await prisma.shoppingCart.deleteMany({
      where: {
        created_at: {
          lt: cutoffTime
        },
        user_id: {
          notIn: protectedUserIds
        }
      }
    });

    console.log(`Performed partial cleanup (test ${cleanupCounter}) - removed data older than 2 minutes, protected ${protectedUserIds.length} users`);
  } catch (error) {
    console.log('Partial cleanup failed:', error);
  }
};

afterAll(async () => {
  // Final comprehensive cleanup after all tests complete
  try {
    // IMPORTANT: Reload protected users and products from file before deletion
    // This ensures we don't delete users/products from previous test suites
    const reloadedProtectedUsers = new Set(testUserIds);
    const reloadedProtectedProducts = new Set(testProductIds);
    
    try {
      if (fs.existsSync(TEST_USERS_FILE)) {
        const data = fs.readFileSync(TEST_USERS_FILE, 'utf8');
        const userIds = JSON.parse(data);
        userIds.forEach((id: string) => reloadedProtectedUsers.add(id));
      }
    } catch (error) {
      // Ignore errors reading file, just use current testUserIds
    }

    try {
      if (fs.existsSync(TEST_PRODUCTS_FILE)) {
        const data = fs.readFileSync(TEST_PRODUCTS_FILE, 'utf8');
        const productIds = JSON.parse(data);
        productIds.forEach((id: string) => reloadedProtectedProducts.add(id));
      }
    } catch (error) {
      // Ignore errors reading file, just use current testProductIds
    }

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

      // Only delete products that are not in the protected reloadedProtectedProducts set
      // Keep test products around for other test suites to use
      if (reloadedProtectedProducts.size > 0) {
        await prisma.product.deleteMany({
          where: {
            id: {
              notIn: Array.from(reloadedProtectedProducts)
            }
          }
        });
      } else {
        await prisma.product.deleteMany();
      }

      // Only delete users that are not in the protected testUserIds set (including reloaded ones)
      if (reloadedProtectedUsers.size > 0) {
        await prisma.user.deleteMany({
          where: {
            id: {
              notIn: Array.from(reloadedProtectedUsers)
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

    // Clean up test resource files after all tests complete
    // These files were used to protect resources within this test run
    // They should be deleted so each test run starts fresh
    try {
      if (fs.existsSync(TEST_USERS_FILE)) {
        fs.unlinkSync(TEST_USERS_FILE);
        console.log('Cleaned up test-users.json');
      }
    } catch (error) {
      console.log('Failed to clean up test-users.json:', error);
    }

    try {
      if (fs.existsSync(TEST_PRODUCTS_FILE)) {
        fs.unlinkSync(TEST_PRODUCTS_FILE);
        console.log('Cleaned up test-products.json');
      }
    } catch (error) {
      console.log('Failed to clean up test-products.json:', error);
    }
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
        role: userData.role || 'USER',
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
    saveProtectedProducts(); // Save to file for persistence
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
        role: userData.role || 'USER',
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