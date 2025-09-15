import { prisma } from '../../config/database';
import { Order, OrderItem, OrderStatus } from '../../models';

export interface CreateOrderInput {
  user_id: string;
  shipping_address: string;
  billing_address: string;
}

export interface OrderWithItems {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_address: string;
  billing_address: string;
  created_at: Date;
  updated_at: Date;
  items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    price_at_time: number;
    product: {
      id: string;
      name: string;
      image_url?: string;
    };
  }>;
  payment?: {
    id: string;
    status: string;
    payment_method: string;
    amount: number;
  } | undefined;
}

export interface OrderFilters {
  status?: OrderStatus;
  user_id?: string;
  start_date?: Date;
  end_date?: Date;
}

export interface OrderQueryOptions {
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'total_amount' | 'status';
  sortOrder?: 'asc' | 'desc';
  filters?: OrderFilters;
}

export interface OrderListResponse {
  orders: OrderWithItems[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class OrderService {
  async createOrder(input: CreateOrderInput): Promise<OrderWithItems> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { user_id: input.user_id },
      include: {
        cart_items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.cart_items.length === 0) {
      throw new Error('Cart is empty');
    }

    for (const cartItem of cart.cart_items) {
      if (!cartItem.product.is_active || cartItem.product.stock_quantity < cartItem.quantity) {
        throw new Error(`Product ${cartItem.product.name} is not available in the requested quantity`);
      }
    }

    const total_amount = cart.cart_items.reduce(
      (sum, item) => sum + (item.price_at_time * item.quantity),
      0
    );

    const order = await prisma.order.create({
      data: {
        user_id: input.user_id,
        total_amount,
        shipping_address: input.shipping_address,
        billing_address: input.billing_address,
      },
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
    });

    for (const cartItem of cart.cart_items) {
      await prisma.orderItem.create({
        data: {
          order_id: order.id,
          product_id: cartItem.product_id,
          quantity: cartItem.quantity,
          price_at_time: cartItem.price_at_time,
        },
      });

      await prisma.product.update({
        where: { id: cartItem.product_id },
        data: {
          stock_quantity: {
            decrement: cartItem.quantity,
          },
        },
      });
    }

    await prisma.cartItem.deleteMany({
      where: { cart_id: cart.id },
    });

    return this.transformOrder(order);
  }

  async getOrderById(id: string): Promise<OrderWithItems | null> {
    const order = await prisma.order.findUnique({
      where: { id },
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
    });

    return order ? this.transformOrder(order) : null;
  }

  async getOrdersByUser(user_id: string, options: OrderQueryOptions = {}): Promise<OrderListResponse> {
    const filtersWithUser = { ...options.filters, user_id };
    return this.getOrders({ ...options, filters: filtersWithUser });
  }

  async getOrders(options: OrderQueryOptions = {}): Promise<OrderListResponse> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc',
      filters = {},
    } = options;

    const offset = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.user_id) {
      where.user_id = filters.user_id;
    }

    if (filters.start_date || filters.end_date) {
      where.created_at = {};
      if (filters.start_date) {
        where.created_at.gte = filters.start_date;
      }
      if (filters.end_date) {
        where.created_at.lte = filters.end_date;
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
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
      prisma.order.count({ where }),
    ]);

    const transformedOrders = orders.map(order => this.transformOrder(order));
    const totalPages = Math.ceil(total / limit);

    return {
      orders: transformedOrders,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<OrderWithItems> {
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
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
    });

    return this.transformOrder(updatedOrder);
  }

  async cancelOrder(id: string, user_id: string): Promise<OrderWithItems> {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        order_items: {
          include: {
            product: true,
          },
        },
        payment: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.user_id !== user_id) {
      throw new Error('Unauthorized to cancel this order');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new Error('Order cannot be cancelled at this stage');
    }

    if (order.payment && order.payment.status === 'SUCCEEDED') {
      throw new Error('Cannot cancel order with successful payment');
    }

    for (const orderItem of order.order_items) {
      await prisma.product.update({
        where: { id: orderItem.product_id },
        data: {
          stock_quantity: {
            increment: orderItem.quantity,
          },
        },
      });
    }

    const cancelledOrder = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
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
    });

    return this.transformOrder(cancelledOrder);
  }

  async getOrderStats(user_id?: string): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    ordersByStatus: Record<OrderStatus, number>;
  }> {
    const where = user_id ? { user_id } : {};

    const [orders, totalRevenue] = await Promise.all([
      prisma.order.findMany({ where }),
      prisma.order.aggregate({
        where,
        _sum: { total_amount: true },
      }),
    ]);

    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? (totalRevenue._sum.total_amount || 0) / totalOrders : 0;

    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<OrderStatus, number>);

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.total_amount || 0,
      averageOrderValue,
      ordersByStatus,
    };
  }

  private transformOrder(order: any): OrderWithItems {
    return {
      id: order.id,
      user_id: order.user_id,
      status: order.status,
      total_amount: order.total_amount,
      shipping_address: order.shipping_address,
      billing_address: order.billing_address,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: order.order_items.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_time: item.price_at_time,
        product: item.product,
      })),
      payment: order.payment ? {
        id: order.payment.id,
        status: order.payment.status,
        payment_method: order.payment.payment_method,
        amount: order.payment.amount,
      } : undefined,
    };
  }
}