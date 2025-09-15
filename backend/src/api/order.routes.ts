import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { OrderService, CreateOrderInput, OrderStatus } from '../lib/order/OrderService';

const router = Router();
const orderService = new OrderService();

// Get all orders (with filtering and pagination)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['created_at', 'total_amount', 'status']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('status').optional().isIn(Object.values(OrderStatus)).withMessage('Invalid order status'),
  query('user_id').optional().isUUID().withMessage('Invalid user ID'),
  query('start_date').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('end_date').optional().isISO8601().withMessage('End date must be a valid date'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      sortBy: req.query.sortBy as string || 'created_at',
      sortOrder: req.query.sortOrder as string || 'desc',
      filters: {
        status: req.query.status as OrderStatus || undefined,
        user_id: req.query.user_id as string || undefined,
        start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
      },
    };

    const result = await orderService.getOrders(options);

    res.json({
      message: 'Orders retrieved successfully',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new order
router.post('/', [
  body('shipping_address').notEmpty().withMessage('Shipping address is required'),
  body('billing_address').notEmpty().withMessage('Billing address is required'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

    const input: CreateOrderInput = {
      user_id: userId,
      shipping_address: req.body.shipping_address,
      billing_address: req.body.billing_address,
    };

    const order = await orderService.createOrder(input);

    res.status(201).json({
      message: 'Order created successfully',
      data: order,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('Cart is empty') ? 400 :
                       error.message.includes('not available') ? 400 : 400;
      return res.status(statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific order by ID
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid order ID'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const order = await orderService.getOrderById(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      message: 'Order retrieved successfully',
      data: order,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel an order
router.post('/:id/cancel', [
  param('id').isUUID().withMessage('Invalid order ID'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

    const { id } = req.params;
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
      return res.status(statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's orders
router.get('/user/:userId', [
  param('userId').isUUID().withMessage('Invalid user ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['created_at', 'total_amount', 'status']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('status').optional().isIn(Object.values(OrderStatus)).withMessage('Invalid order status'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const options = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      sortBy: req.query.sortBy as string || 'created_at',
      sortOrder: req.query.sortOrder as string || 'desc',
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
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get order statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
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
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;