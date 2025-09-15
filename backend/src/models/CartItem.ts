import { Prisma } from '@prisma/client';

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  price_at_time: number;
  created_at: Date;
}

export interface CreateCartItemInput {
  cart_id: string;
  product_id: string;
  quantity: number;
  price_at_time: number;
}

export interface UpdateCartItemInput {
  quantity?: number;
  price_at_time?: number;
}

export interface CartItemWithProduct extends CartItem {
  product: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    is_active: boolean;
  };
}

export const cartItemSelect = {
  id: true,
  cart_id: true,
  product_id: true,
  quantity: true,
  price_at_time: true,
  created_at: true,
} as const;

export const cartItemWithProductSelect = {
  id: true,
  cart_id: true,
  product_id: true,
  quantity: true,
  price_at_time: true,
  created_at: true,
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      image_url: true,
      is_active: true,
    },
  },
} as const;

export type CartItemResponse = Prisma.CartItemGetPayload<{
  select: typeof cartItemSelect;
}>;

export type CartItemWithProductResponse = Prisma.CartItemGetPayload<{
  select: typeof cartItemWithProductSelect;
}>;