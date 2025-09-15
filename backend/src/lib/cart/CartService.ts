import { prisma } from '../../config/database';
import { ShoppingCart, CartItem } from '../../models';

export interface AddToCartInput {
  user_id: string;
  product_id: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}

export interface CartWithItems {
  id: string;
  user_id: string;
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
      price: number;
      image_url?: string;
      stock_quantity: number;
    };
  }>;
  total_items: number;
  total_amount: number;
}

export class CartService {
  async getOrCreateCart(user_id: string): Promise<ShoppingCart> {
    let cart = await prisma.shoppingCart.findUnique({
      where: { user_id },
      include: {
        cart_items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.shoppingCart.create({
        data: { user_id },
        include: {
          cart_items: {
            include: {
              product: true,
            },
          },
        },
      });
    }

    return cart;
  }

  async getCart(user_id: string): Promise<CartWithItems | null> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { user_id },
      include: {
        cart_items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                image_url: true,
                stock_quantity: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return null;
    }

    const items = cart.cart_items.map(item => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_time: item.price_at_time,
      product: item.product,
    }));

    const total_items = items.reduce((sum, item) => sum + item.quantity, 0);
    const total_amount = items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0);

    return {
      id: cart.id,
      user_id: cart.user_id,
      created_at: cart.created_at,
      updated_at: cart.updated_at,
      items,
      total_items,
      total_amount,
    };
  }

  async addToCart(input: AddToCartInput): Promise<CartWithItems> {
    const { user_id, product_id, quantity } = input;

    const product = await prisma.product.findUnique({
      where: { id: product_id },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.is_active) {
      throw new Error('Product is not active');
    }

    if (product.stock_quantity < quantity) {
      throw new Error('Insufficient stock');
    }

    const cart = await this.getOrCreateCart(user_id);

    const existingItem = cart.cart_items.find(item => item.product_id === product_id);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock_quantity) {
        throw new Error('Insufficient stock');
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cart_id: cart.id,
          product_id,
          quantity,
          price_at_time: product.price,
        },
      });
    }

    return this.getCart(user_id) as Promise<CartWithItems>;
  }

  async updateCartItem(user_id: string, item_id: string, input: UpdateCartItemInput): Promise<CartWithItems> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { user_id },
      include: {
        cart_items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    const cartItem = cart.cart_items.find(item => item.id === item_id);
    if (!cartItem) {
      throw new Error('Cart item not found');
    }

    if (input.quantity > cartItem.product.stock_quantity) {
      throw new Error('Insufficient stock');
    }

    if (input.quantity <= 0) {
      await this.removeFromCart(user_id, item_id);
      return this.getCart(user_id) as Promise<CartWithItems>;
    }

    await prisma.cartItem.update({
      where: { id: item_id },
      data: { quantity: input.quantity },
    });

    return this.getCart(user_id) as Promise<CartWithItems>;
  }

  async removeFromCart(user_id: string, item_id: string): Promise<CartWithItems> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { user_id },
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: item_id },
    });

    if (!cartItem || cartItem.cart_id !== cart.id) {
      throw new Error('Cart item not found');
    }

    await prisma.cartItem.delete({
      where: { id: item_id },
    });

    return this.getCart(user_id) as Promise<CartWithItems>;
  }

  async clearCart(user_id: string): Promise<void> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { user_id },
    });

    if (!cart) {
      return;
    }

    await prisma.cartItem.deleteMany({
      where: { cart_id: cart.id },
    });
  }

  async getCartItem(user_id: string, item_id: string): Promise<CartItem | null> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { user_id },
    });

    if (!cart) {
      return null;
    }

    return prisma.cartItem.findFirst({
      where: { id: item_id, cart_id: cart.id },
    });
  }

  async getCartItemCount(user_id: string): Promise<number> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { user_id },
    });

    if (!cart) {
      return 0;
    }

    const items = await prisma.cartItem.findMany({
      where: { cart_id: cart.id },
    });

    return items.reduce((sum, item) => sum + item.quantity, 0);
  }

  async getCartTotal(user_id: string): Promise<number> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { user_id },
      include: {
        cart_items: true,
      },
    });

    if (!cart) {
      return 0;
    }

    return cart.cart_items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0);
  }

  async validateCartItems(user_id: string): Promise<{ valid: boolean; invalidItems: string[] }> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { user_id },
      include: {
        cart_items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      return { valid: true, invalidItems: [] };
    }

    const invalidItems: string[] = [];

    for (const item of cart.cart_items) {
      if (!item.product.is_active || item.product.stock_quantity < item.quantity) {
        invalidItems.push(item.id);
      }
    }

    return { valid: invalidItems.length === 0, invalidItems };
  }

  async moveItemToOrder(user_id: string, order_id: string): Promise<void> {
    const cart = await prisma.shoppingCart.findUnique({
      where: { user_id },
      include: {
        cart_items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      throw new Error('Cart not found');
    }

    for (const cartItem of cart.cart_items) {
      await prisma.orderItem.create({
        data: {
          order_id,
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

    await this.clearCart(user_id);
  }
}