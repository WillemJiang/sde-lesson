import { Prisma } from '@prisma/client';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  sku: string;
  category: string;
  image_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  sku: string;
  category: string;
  image_url?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number;
  stock_quantity?: number;
  sku?: string;
  category?: string;
  image_url?: string;
  is_active?: boolean;
}

export interface ProductFilters {
  category?: string;
  search?: string;
  min_price?: number;
  max_price?: number;
  is_active?: boolean;
}

export interface ProductQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'price' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  filters?: ProductFilters;
}

export const productSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  stock_quantity: true,
  sku: true,
  category: true,
  image_url: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

export type ProductResponse = Prisma.ProductGetPayload<{
  select: typeof productSelect;
}>;