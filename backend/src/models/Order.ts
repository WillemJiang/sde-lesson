import { Prisma } from '@prisma/client';
import { OrderItem } from './OrderItem';

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_address: string;
  billing_address: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  total_items: number;
}

export interface CreateOrderInput {
  user_id: string;
  total_amount: number;
  shipping_address: string;
  billing_address: string;
}

export interface UpdateOrderInput {
  status?: OrderStatus;
  shipping_address?: string;
  billing_address?: string;
}

export interface OrderFilters {
  status?: OrderStatus;
  user_id?: string;
  date_from?: Date;
  date_to?: Date;
}

export interface OrderQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'total_amount' | 'status';
  sortOrder?: 'asc' | 'desc';
  filters?: OrderFilters;
}

export const orderSelect = {
  id: true,
  user_id: true,
  status: true,
  total_amount: true,
  shipping_address: true,
  billing_address: true,
  created_at: true,
  updated_at: true,
} as const;

export const orderWithItemsSelect = {
  id: true,
  user_id: true,
  status: true,
  total_amount: true,
  shipping_address: true,
  billing_address: true,
  created_at: true,
  updated_at: true,
  order_items: {
    select: {
      id: true,
      product_id: true,
      quantity: true,
      price_at_time: true,
      created_at: true,
      product: {
        select: {
          id: true,
          name: true,
          image_url: true,
        },
      },
    },
  },
} as const;

export type OrderResponse = Prisma.OrderGetPayload<{
  select: typeof orderSelect;
}>;

export type OrderWithItemsResponse = Prisma.OrderGetPayload<{
  select: typeof orderWithItemsSelect;
}>;