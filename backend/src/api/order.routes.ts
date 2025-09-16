import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { OrderService, CreateOrderInput } from '../lib/order/OrderService';
import { OrderStatus, OrderQueryOptions } from '../models/Order';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const orderService = new OrderService();

// Get all orders (with filtering and pagination)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['created_at', 'total_amount', 'status']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('status').optional().isIn(Object.values(OrderStatus)).withMessage('Invalid order status'),
  query('user_id').optional().isString().withMessage('User ID must be a string').isLength({ min: 1 }).withMessage('User ID cannot be empty'),
  query('start_date').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('end_date').optional().isISO8601().withMessage('End date must be a valid date'),
], authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const options: OrderQueryOptions = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      sortBy: (req.query.sortBy as 'created_at' | 'total_amount' | 'status') || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    };

    if (req.query.status) options.filters = { status: req.query.status as OrderStatus };
    if (req.query.user_id) {
      options.filters = { ...options.filters, user_id: req.query.user_id as string };
    }
    if (req.query.start_date) {
      options.filters = { ...options.filters, date_from: new Date(req.query.start_date as string) };
    }
    if (req.query.end_date) {
      options.filters = { ...options.filters, date_to: new Date(req.query.end_date as string) };
    }

    const result = await orderService.getOrders(options);

    res.json({
      message: 'Orders retrieved successfully',
      orders: result.orders,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        total_pages: result.totalPages,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new order
router.post('/', [
  body('shipping_address').notEmpty().withMessage('Shipping address is required'),
  body('billing_address').notEmpty().withMessage('Billing address is required'),
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

    // Convert address objects to strings if needed
    const shippingAddress = typeof req.body.shipping_address === 'object'
      ? JSON.stringify(req.body.shipping_address)
      : req.body.shipping_address;
    const billingAddress = typeof req.body.billing_address === 'object'
      ? JSON.stringify(req.body.billing_address)
      : req.body.billing_address;

    const input: CreateOrderInput = {
      user_id: userId,
      shipping_address: shippingAddress,
      billing_address: billingAddress,
    };

    console.log('Creating order with input:', input);
    console.log('About to call orderService.createOrder');

    const order = await orderService.createOrder(input);
    console.log('Order created successfully:', order);

    res.status(201).json({
      message: 'Order created successfully',
      data: order,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('Cart is empty') ? 400 :
                       error.message.includes('not available') ? 400 : 400;
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific order by ID
router.get('/:id', [
  param('id').matches(/^[a-z0-9]+$/).withMessage('Invalid order ID format'),
], authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Order ID is required' });
      return;
    }
    const order = await orderService.getOrderById(id);

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json({
      message: 'Order retrieved successfully',
      data: order,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel an order
router.post('/:id/cancel', [
  param('id').matches(/^[a-z0-9]+$/).withMessage('Invalid order ID format'),
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
      res.status(400).json({ error: 'Order ID is required' });
      return;
    }
    const order = await orderService.cancelOrder(id, userId);

    res.json({
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('Unauthorized') ? 403 :
                       error.message.includes('cannot be cancelled') ? 400 : 400;
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's orders
router.get('/user/:userId', [
  param('userId').matches(/^[a-z0-9]+$/).withMessage('Invalid user ID format'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['created_at', 'total_amount', 'status']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('status').optional().isIn(Object.values(OrderStatus)).withMessage('Invalid order status'),
], authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }
    const options = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      sortBy: (req.query.sortBy as 'created_at' | 'total_amount' | 'status') || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      filters: {
        status: req.query.status as OrderStatus || undefined,
      },
    };

    const result = await orderService.getOrdersByUser(userId, options);

    res.json({
      message: 'User orders retrieved successfully',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get order statistics
router.get('/stats/summary', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // In a real app, you'd get this from JWT authentication and check if user is admin
    const userId = req.query.user_id as string || undefined;

    const stats = await orderService.getOrderStats(userId);

    res.json({
      message: 'Order statistics retrieved successfully',
      data: stats,
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