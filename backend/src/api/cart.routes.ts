import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { CartService, AddToCartInput, UpdateCartItemInput } from '../lib/cart/CartService';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const cartService = new CartService();

// Get user's shopping cart
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    let cart = await cartService.getCart(userId);

    // If cart doesn't exist, create a new empty cart
    if (!cart) {
      const newCart = await cartService.getOrCreateCart(userId);
      // Format the cart data properly
      const formattedCart = {
        id: newCart.id,
        user_id: newCart.user_id,
        created_at: newCart.created_at,
        updated_at: newCart.updated_at,
        items: [],
        total_items: 0,
        total_amount: 0,
      };
      res.json({
        message: 'Cart retrieved successfully',
        data: formattedCart,
      });
      return;
    }

    res.json({
      message: 'Cart retrieved successfully',
      data: cart,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add item to cart
router.post('/items', [
  body('product_id').custom((value) => {
    // Allow our custom ID format (letters followed by letters/numbers)
    if (/^[a-z]+[a-z0-9]+$/.test(value)) {
      return true;
    }
    // Allow valid UUID format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
      return true;
    }
    // Reject invalid format
    throw new Error('Invalid product ID format');
  }),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
], authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const input: AddToCartInput = {
      user_id: userId,
      product_id: req.body.product_id,
      quantity: parseInt(req.body.quantity),
    };

    const cart = await cartService.addToCart(input);

    // Find the added/updated item in the cart
    const addedItem = cart.items.find(item => item.product_id === input.product_id);

    res.status(201).json({
      message: 'Item added to cart successfully',
      data: cart,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('stock') ? 400 : 400;
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update cart item quantity
router.put('/items/:id', [
  param('id').isUUID().withMessage('Invalid cart item ID format'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
], authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Cart item ID is required' });
      return;
    }
    const input: UpdateCartItemInput = {
      quantity: parseInt(req.body.quantity),
    };

    const cart = await cartService.updateCartItem(userId, id, input);

    res.json({
      message: 'Cart item updated successfully',
      data: cart,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('stock') ? 400 : 400;
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove item from cart
router.delete('/items/:id', [
  param('id').isUUID().withMessage('Invalid cart item ID format'),
], authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Cart item ID is required' });
      return;
    }
    await cartService.removeFromCart(userId, id);

    res.status(204).send();
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear entire cart
router.delete('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    await cartService.clearCart(userId);

    res.json({
      message: 'Cart cleared successfully',
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get cart item count
router.get('/count', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const count = await cartService.getCartItemCount(userId);

    res.json({
      message: 'Cart item count retrieved successfully',
      data: { count },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get cart total amount
router.get('/total', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const total = await cartService.getCartTotal(userId);

    res.json({
      message: 'Cart total retrieved successfully',
      data: { total },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate cart items (check stock and availability)
router.get('/validate', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const validation = await cartService.validateCartItems(userId);

    res.json({
      message: 'Cart validation completed',
      data: validation,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;