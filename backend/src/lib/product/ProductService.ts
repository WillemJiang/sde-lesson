import { prisma } from '../../config/database';
import {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
  ProductQueryOptions,
  ProductResponse,
  productSelect
} from '../../models/Product';

export interface ProductListResponse {
  products: ProductResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ProductService {
  async createProduct(input: CreateProductInput): Promise<ProductResponse> {
    const existingProduct = await prisma.product.findUnique({
      where: { sku: input.sku },
    });

    if (existingProduct) {
      throw new Error('Product with this SKU already exists');
    }

    const product = await prisma.product.create({
      data: input,
      select: productSelect,
    });

    return product;
  }

  async getProductById(id: string): Promise<ProductResponse | null> {
    const product = await prisma.product.findUnique({
      where: { id },
      select: productSelect,
    });

    return product;
  }

  async getProducts(options: ProductQueryOptions = {}): Promise<ProductListResponse> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      filters = {},
    } = options;

    const offset = (page - 1) * limit;

    const where: any = {};

    if (filters.category) {
      where.category = { contains: filters.category };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
        { sku: { contains: filters.search } },
      ];
    }

    if (filters.min_price !== undefined && filters.max_price !== undefined) {
      if (filters.min_price > filters.max_price) {
        throw new Error('Minimum price cannot be greater than maximum price');
      }
      where.price = { gte: filters.min_price, lte: filters.max_price };
    } else if (filters.min_price !== undefined) {
      where.price = { gte: filters.min_price };
    } else if (filters.max_price !== undefined) {
      where.price = { lte: filters.max_price };
    }

    if (filters.is_active !== undefined) {
      where.is_active = filters.is_active;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: productSelect,
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      products,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<ProductResponse> {
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new Error('Product not found');
    }

    if (input.sku && input.sku !== existingProduct.sku) {
      const skuExists = await prisma.product.findUnique({
        where: { sku: input.sku },
      });

      if (skuExists) {
        throw new Error('Product with this SKU already exists');
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: input,
      select: productSelect,
    });

    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    await prisma.product.delete({
      where: { id },
    });
  }

  async updateStock(id: string, quantity: number): Promise<ProductResponse> {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const newStock = product.stock_quantity + quantity;
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { stock_quantity: newStock },
      select: productSelect,
    });

    return updatedProduct;
  }

  async getProductsByCategory(category: string, options: ProductQueryOptions = {}): Promise<ProductListResponse> {
    const filtersWithCategory = { ...options.filters, category };
    return this.getProducts({ ...options, filters: filtersWithCategory });
  }

  async searchProducts(query: string, options: ProductQueryOptions = {}): Promise<ProductListResponse> {
    const filtersWithSearch = { ...options.filters, search: query };
    return this.getProducts({ ...options, filters: filtersWithSearch });
  }

  async getProductsInPriceRange(minPrice: number, maxPrice: number, options: ProductQueryOptions = {}): Promise<ProductListResponse> {
    const filtersWithPrice = { ...options.filters, min_price: minPrice, max_price: maxPrice };
    return this.getProducts({ ...options, filters: filtersWithPrice });
  }

  async getTotalProductCount(): Promise<number> {
    return prisma.product.count();
  }

  async getLowStockProducts(threshold: number = 10): Promise<ProductResponse[]> {
    return prisma.product.findMany({
      where: { stock_quantity: { lte: threshold } },
      select: productSelect,
    });
  }

  async getActiveProducts(options: ProductQueryOptions = {}): Promise<ProductListResponse> {
    const filtersWithActive = { ...options.filters, is_active: true };
    return this.getProducts({ ...options, filters: filtersWithActive });
  }

  async bulkUpdateStock(updates: Array<{ id: string; quantity: number }>): Promise<ProductResponse[]> {
    const results = await Promise.all(
      updates.map(update => this.updateStock(update.id, update.quantity))
    );
    return results;
  }
}