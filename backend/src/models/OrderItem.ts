import { Prisma } from '@prisma/client';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_time: number;
  created_at: Date;
}

export interface CreateOrderItemInput {
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_time: number;
}

export interface OrderItemWithProduct extends OrderItem {
  product: {
    id: string;
    name: string;
    image_url?: string;
  };
}

export const orderItemSelect = {
  id: true,
  order_id: true,
  product_id: true,
  quantity: true,
  price_at_time: true,
  created_at: true,
} as const;

export const orderItemWithProductSelect = {
  id: true,
  order_id: true,
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
} as const;

export type OrderItemResponse = Prisma.OrderItemGetPayload<{
  select: typeof orderItemSelect;
}>;

export type OrderItemWithProductResponse = Prisma.OrderItemGetPayload<{
  select: typeof orderItemWithProductSelect;
}>;