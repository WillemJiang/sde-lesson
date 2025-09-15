import { Prisma } from '@prisma/client';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface Payment {
  id: string;
  order_id: string;
  stripe_payment_intent_id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentInput {
  order_id: string;
  stripe_payment_intent_id: string;
  amount: number;
  payment_method: string;
}

export interface UpdatePaymentInput {
  status?: string;
  stripe_payment_intent_id?: string;
  payment_method?: string;
}

export interface PaymentWithOrder extends Payment {
  order: {
    id: string;
    user_id: string;
    status: string;
    total_amount: number;
  };
}

export const paymentSelect = {
  id: true,
  order_id: true,
  stripe_payment_intent_id: true,
  amount: true,
  status: true,
  payment_method: true,
  created_at: true,
  updated_at: true,
} as const;

export const paymentWithOrderSelect = {
  id: true,
  order_id: true,
  stripe_payment_intent_id: true,
  amount: true,
  status: true,
  payment_method: true,
  created_at: true,
  updated_at: true,
  order: {
    select: {
      id: true,
      user_id: true,
      status: true,
      total_amount: true,
    },
  },
} as const;

export type PaymentResponse = Prisma.PaymentGetPayload<{
  select: typeof paymentSelect;
}>;

export type PaymentWithOrderResponse = Prisma.PaymentGetPayload<{
  select: typeof paymentWithOrderSelect;
}>;