import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// Set environment to reduce Prisma logging in tests
process.env.LOG_LEVEL = 'warn';

let prisma: PrismaClient;

// Store test users and tokens to prevent deletion during test runs
const testUserIds = new Set<string>();
const testProductIds = new Set<string>();

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
  // Clean up database before each test, but preserve test users and products
  try {
    // Wait for any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Use raw SQL to disable foreign key constraints and clean up
    if (process.env.DATABASE_URL?.includes('sqlite')) {
      // SQLite approach
      await prisma.$executeRaw`PRAGMA foreign_keys = OFF;`;

      await prisma.$executeRaw`DELETE FROM Payment;`;
      await prisma.$executeRaw`DELETE FROM OrderItem;`;
      await prisma.$executeRaw`DELETE FROM "Order";`;
      await prisma.$executeRaw`DELETE FROM CartItem;`;
      await prisma.$executeRaw`DELETE FROM ShoppingCart;`;

      // Delete non-test products
      if (testProductIds.size > 0) {
        const productIds = Array.from(testProductIds);
        const placeholders = productIds.map(() => '?').join(',');
        await prisma.$executeRawUnsafe(`DELETE FROM Product WHERE id NOT IN (${placeholders})`, ...productIds);
      } else {
        await prisma.$executeRaw`DELETE FROM Product;`;
      }

      // Delete non-test users
      if (testUserIds.size > 0) {
        const userIds = Array.from(testUserIds);
        const placeholders = userIds.map(() => '?').join(',');
        await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id NOT IN (${placeholders})`, ...userIds);
      } else {
        await prisma.$executeRaw`DELETE FROM "User";`;
      }

      await prisma.$executeRaw`PRAGMA foreign_keys = ON;`;
    } else {
      // PostgreSQL approach - just use regular Prisma operations with proper ordering
      await prisma.payment.deleteMany();
      await prisma.orderItem.deleteMany();
      await prisma.order.deleteMany();
      await prisma.cartItem.deleteMany();
      await prisma.shoppingCart.deleteMany();

      // Only delete products that are not test products
      if (testProductIds.size > 0) {
        await prisma.product.deleteMany({
          where: {
            id: {
              notIn: Array.from(testProductIds)
            }
          }
        });
      } else {
        await prisma.product.deleteMany();
      }

      // Only delete users that are not test users
      await prisma.user.deleteMany({
        where: {
          id: {
            notIn: Array.from(testUserIds)
          }
        }
      });
    }

    // Final delay to ensure all cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 200));
  } catch (error) {
    // If tables don't exist or other errors, just continue
    console.log('Database cleanup skipped:', error);
  }
});

afterAll(async () => {
  // Clean up all test users and products after all tests complete
  try {
    // First delete all dependent data for test users
    await prisma.payment.deleteMany({
      where: {
        order: {
          user_id: {
            in: Array.from(testUserIds)
          }
        }
      }
    });

    await prisma.orderItem.deleteMany({
      where: {
        order: {
          user_id: {
            in: Array.from(testUserIds)
          }
        }
      }
    });

    await prisma.order.deleteMany({
      where: {
        user_id: {
          in: Array.from(testUserIds)
        }
      }
    });

    await prisma.cartItem.deleteMany({
      where: {
        cart: {
          user_id: {
            in: Array.from(testUserIds)
          }
        }
      }
    });

    await prisma.shoppingCart.deleteMany({
      where: {
        user_id: {
          in: Array.from(testUserIds)
        }
      }
    });

    // Now delete the test users
    await prisma.user.deleteMany({
      where: {
        id: {
          in: Array.from(testUserIds)
        }
      }
    });
    testUserIds.clear();

    // Delete test products
    await prisma.product.deleteMany({
      where: {
        id: {
          in: Array.from(testProductIds)
        }
      }
    });
    testProductIds.clear();
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