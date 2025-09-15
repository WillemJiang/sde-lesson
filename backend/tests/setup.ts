import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

beforeAll(async () => {
  // Use the existing database but ensure it's properly set up
  prisma = new PrismaClient();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up database before each test
  try {
    const tablenames = await prisma.$queryRaw<
      Array<{ name: string }>
    >`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`;

    // Delete from tables in the correct order to respect foreign key constraints
    const orderedTables = ['payments', 'order_items', 'orders', 'cart_items', 'shopping_carts', 'products', 'users'];

    for (const tableName of orderedTables) {
      if (tablenames.some(t => t.name === tableName)) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${tableName};`);
      }
    }

    // Delete any remaining tables
    for (const { name } of tablenames) {
      if (!orderedTables.includes(name)) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${name};`);
      }
    }
  } catch (error) {
    // If the database doesn't exist or tables don't exist, just continue
    console.log('Database cleanup skipped:', error);
  }
});

// Global test utilities
declare global {
  var testUtils: {
    createUser: (userData: any) => Promise<any>;
    createProduct: (productData: any) => Promise<any>;
  };
}

global.testUtils = {
  createUser: async (userData: any) => {
    return await prisma.user.create({
      data: {
        email: userData.email || 'test@example.com',
        password_hash: userData.password_hash || 'hashedpassword',
        first_name: userData.first_name || 'Test',
        last_name: userData.last_name || 'User',
        is_verified: userData.is_verified || true,
      },
    });
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
};