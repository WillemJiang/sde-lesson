import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { CartService, AddToCartInput, UpdateCartItemInput } from '../lib/cart/CartService';

const router = Router();
const cartService = new CartService();

// Get user's shopping cart
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

    const cart = await cartService.getCart(userId);

    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
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
  body('product_id').isUUID().withMessage('Invalid product ID'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

    const input: AddToCartInput = {
      user_id: userId,
      product_id: req.body.product_id,
      quantity: parseInt(req.body.quantity),
    };

    const cart = await cartService.addToCart(input);

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
  param('id').isUUID().withMessage('Invalid cart item ID'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

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
  param('id').isUUID().withMessage('Invalid cart item ID'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Cart item ID is required' });
      return;
    }
    const cart = await cartService.removeFromCart(userId, id);

    res.json({
      message: 'Item removed from cart successfully',
      data: cart,
    });
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
router.delete('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

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
router.get('/count', async (req: Request, res: Response): Promise<void> => {
  try {
    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

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
router.get('/total', async (req: Request, res: Response): Promise<void> => {
  try {
    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

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
router.get('/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

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