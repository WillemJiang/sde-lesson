import { Prisma } from '@prisma/client';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  is_verified: boolean;
  verification_token?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  email: string;
  first_name: string;
  last_name: string;
  verification_token?: string;
}

export interface UpdateUserInput {
  email?: string;
  first_name?: string;
  last_name?: string;
  is_verified?: boolean;
  verification_token?: string;
}

export const userSelect = {
  id: true,
  email: true,
  first_name: true,
  last_name: true,
  is_verified: true,
  created_at: true,
  updated_at: true,
} as const;

export type UserWithoutPassword = Prisma.UserGetPayload<{
  select: typeof userSelect;
}>;