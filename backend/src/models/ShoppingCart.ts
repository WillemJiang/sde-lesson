import { Prisma } from '@prisma/client';
import { CartItem } from './CartItem';

export interface ShoppingCart {
  id: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface ShoppingCartWithItems extends ShoppingCart {
  cart_items: CartItem[];
  total_items: number;
  total_amount: number;
}

export interface CreateCartInput {
  user_id: string;
}

export interface AddToCartInput {
  product_id: string;
  quantity: number;
  price_at_time: number;
}

export const shoppingCartSelect = {
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
} as const;

export const shoppingCartWithItemsSelect = {
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true,
  cart_items: {
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
          price: true,
          image_url: true,
          is_active: true,
        },
      },
    },
  },
} as const;

export type ShoppingCartResponse = Prisma.ShoppingCartGetPayload<{
  select: typeof shoppingCartSelect;
}>;

export type ShoppingCartWithItemsResponse = Prisma.ShoppingCartGetPayload<{
  select: typeof shoppingCartWithItemsSelect;
}>;