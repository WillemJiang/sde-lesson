import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

beforeAll(async () => {
  // Use a test database URL
  process.env.DATABASE_URL = 'file:./test.db';
  
  prisma = new PrismaClient();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up database before each test
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM sqlite_master WHERE type='table' AND tablename NOT LIKE 'sqlite_%';`;
  
  for (const { tablename } of tablenames) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${tablename};`);
  }
});

// Global test utilities
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