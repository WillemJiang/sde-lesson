import { prisma } from '../../config/database';
import { User, CreateUserInput, UpdateUserInput, userSelect, UserWithoutPassword } from '../../models/User';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
  order_count: number;
  total_spent: number;
  last_order_date?: Date | undefined;
}

export interface UserFilters {
  is_verified?: boolean;
  search?: string;
  created_after?: Date;
  created_before?: Date;
}

export interface UserQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'email' | 'first_name' | 'last_name';
  sortOrder?: 'asc' | 'desc';
  filters?: UserFilters;
}

export interface UserListResponse {
  users: UserProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class UserService {
  async createUser(input: CreateUserInput & { password_hash?: string }): Promise<UserWithoutPassword> {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const user = await prisma.user.create({
      data: {
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
        password_hash: input.password_hash || '',
        verification_token: input.verification_token || null,
      },
      select: userSelect,
    });

    return user;
  }

  async getUserById(id: string): Promise<UserWithoutPassword | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    return user;
  }

  async getUserByEmail(email: string): Promise<UserWithoutPassword | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: userSelect,
    });

    return user;
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<UserWithoutPassword> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (input.email && input.email !== user.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (emailExists) {
        throw new Error('Email already registered');
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: input,
      select: userSelect,
    });

    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        orders: true,
        shopping_cart: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.orders.length > 0) {
      throw new Error('Cannot delete user with existing orders');
    }

    if (user.shopping_cart) {
      await prisma.cartItem.deleteMany({
        where: { cart_id: user.shopping_cart.id },
      });
      await prisma.shoppingCart.delete({
        where: { id: user.shopping_cart.id },
      });
    }

    await prisma.user.delete({
      where: { id },
    });
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!user) {
      return null;
    }

    const orders = await prisma.order.findMany({
      where: { user_id: userId },
      select: {
        total_amount: true,
        created_at: true,
      },
    });

    const order_count = orders.length;
    const total_spent = orders.reduce((sum, order) => sum + order.total_amount, 0);
    const last_order_date = orders.length > 0
      ? orders.reduce((latest, order) =>
          order.created_at > latest.created_at ? order : latest
        ).created_at
      : undefined;

    return {
      ...user,
      order_count,
      total_spent,
      last_order_date: last_order_date || undefined,
    };
  }

  async getUsers(options: UserQueryOptions = {}): Promise<UserListResponse> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      filters = {},
    } = options;

    const offset = (page - 1) * limit;

    const where: any = {};

    if (filters.is_verified !== undefined) {
      where.is_verified = filters.is_verified;
    }

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { first_name: { contains: filters.search, mode: 'insensitive' } },
        { last_name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.created_after) {
      where.created_at = { gte: filters.created_after };
    }

    if (filters.created_before) {
      where.created_at = { ...where.created_at, lte: filters.created_before };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: userSelect,
      }),
      prisma.user.count({ where }),
    ]);

    const userProfiles = await Promise.all(
      users.map(user => this.getUserProfile(user.id))
    );

    const totalPages = Math.ceil(total / limit);

    return {
      users: userProfiles.filter(Boolean) as UserProfile[],
      total,
      page,
      limit,
      totalPages,
    };
  }

  async searchUsers(query: string, options: UserQueryOptions = {}): Promise<UserListResponse> {
    const filtersWithSearch = { ...options.filters, search: query };
    return this.getUsers({ ...options, filters: filtersWithSearch });
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    unverifiedUsers: number;
    newUsersThisMonth: number;
    activeUsersThisMonth: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalUsers, verifiedUsers, newUsersThisMonth, activeUsersThisMonth] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { is_verified: true } }),
      prisma.user.count({ where: { created_at: { gte: startOfMonth } } }),
      prisma.user.count({
        where: {
          orders: {
            some: {
              created_at: { gte: startOfMonth },
            },
          },
        },
      }),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      newUsersThisMonth,
      activeUsersThisMonth,
    };
  }

  async deactivateUser(userId: string): Promise<UserWithoutPassword> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { is_verified: false },
      select: userSelect,
    });
  }

  async reactivateUser(userId: string): Promise<UserWithoutPassword> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { is_verified: true },
      select: userSelect,
    });
  }

  async updateUserVerification(userId: string, isVerified: boolean): Promise<UserWithoutPassword> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        is_verified: isVerified,
        verification_token: isVerified ? null : user.verification_token,
      },
      select: userSelect,
    });
  }

  async getUserOrderHistory(userId: string, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { user_id: userId },
        skip: offset,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          order_items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  image_url: true,
                },
              },
            },
          },
          payment: true,
        },
      }),
      prisma.order.count({ where: { user_id: userId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      orders,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getUserPurchaseSummary(userId: string): Promise<{
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    favoriteCategory?: string | undefined;
    lastPurchaseDate?: Date | undefined;
  }> {
    const orders = await prisma.order.findMany({
      where: { user_id: userId },
      include: {
        order_items: {
          include: {
            product: true,
          },
        },
      },
    });

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + order.total_amount, 0);
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

    const categoryCounts = orders.reduce((acc, order) => {
      order.order_items.forEach(item => {
        const category = item.product.category;
        acc[category] = (acc[category] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const favoriteCategory = Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    const lastPurchaseDate = orders.length > 0
      ? orders.reduce((latest, order) =>
          order.created_at > latest.created_at ? order : latest
        ).created_at
      : undefined;

    return {
      totalOrders,
      totalSpent,
      averageOrderValue,
      favoriteCategory: favoriteCategory || undefined,
      lastPurchaseDate: lastPurchaseDate || undefined,
    };
  }
}