import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { UserService, UpdateUserInput } from '../lib/user/UserService';

const router = Router();
const userService = new UserService();

// Get user profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

    const profile = await userService.getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({
      message: 'User profile retrieved successfully',
      data: profile,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', [
  body('first_name').optional().notEmpty().withMessage('First name cannot be empty'),
  body('last_name').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Invalid email address'),
  body('phone').optional().isString(),
  body('address').optional().isString(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

    const updateData: UpdateUserInput = {};

    if (req.body.first_name !== undefined) updateData.first_name = req.body.first_name;
    if (req.body.last_name !== undefined) updateData.last_name = req.body.last_name;
    if (req.body.email !== undefined) updateData.email = req.body.email;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;
    if (req.body.address !== undefined) updateData.address = req.body.address;

    const user = await userService.updateUser(userId, updateData);

    res.json({
      message: 'User profile updated successfully',
      data: user,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('already registered') ? 409 : 400;
      return res.status(statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user order history
router.get('/orders', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const result = await userService.getUserOrderHistory(userId, page, limit);

    res.json({
      message: 'User order history retrieved successfully',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user purchase summary
router.get('/purchase-summary', async (req: Request, res: Response) => {
  try {
    // In a real app, you'd get this from JWT authentication
    const userId = req.headers['user-id'] as string || 'demo-user-id';

    const summary = await userService.getUserPurchaseSummary(userId);

    res.json({
      message: 'User purchase summary retrieved successfully',
      data: summary,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID (admin only)
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid user ID'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const user = await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User retrieved successfully',
      data: user,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (admin only)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['created_at', 'email', 'first_name', 'last_name']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('is_verified').optional().isBoolean().withMessage('is_verified must be a boolean'),
  query('search').optional().isString(),
  query('created_after').optional().isISO8601().withMessage('Created after must be a valid date'),
  query('created_before').optional().isISO8601().withMessage('Created before must be a valid date'),
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
        is_verified: req.query.is_verified !== undefined ? req.query.is_verified === 'true' : undefined,
        search: req.query.search as string || undefined,
        created_after: req.query.created_after ? new Date(req.query.created_after as string) : undefined,
        created_before: req.query.created_before ? new Date(req.query.created_before as string) : undefined,
      },
    };

    const result = await userService.getUsers(options);

    res.json({
      message: 'Users retrieved successfully',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users (admin only)
router.get('/search/:query', [
  param('query').isString().withMessage('Search query is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { query } = req.params;
    const options = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
    };

    const result = await userService.searchUsers(query, options);

    res.json({
      message: 'User search results retrieved successfully',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user statistics (admin only)
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const stats = await userService.getUserStats();

    res.json({
      message: 'User statistics retrieved successfully',
      data: stats,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate user (admin only)
router.patch('/:id/deactivate', [
  param('id').isUUID().withMessage('Invalid user ID'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const user = await userService.deactivateUser(id);

    res.json({
      message: 'User deactivated successfully',
      data: user,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      return res.status(statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reactivate user (admin only)
router.patch('/:id/reactivate', [
  param('id').isUUID().withMessage('Invalid user ID'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const user = await userService.reactivateUser(id);

    res.json({
      message: 'User reactivated successfully',
      data: user,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      return res.status(statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user verification status (admin only)
router.patch('/:id/verification', [
  param('id').isUUID().withMessage('Invalid user ID'),
  body('is_verified').isBoolean().withMessage('is_verified must be a boolean'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { is_verified } = req.body;

    const user = await userService.updateUserVerification(id, is_verified);

    res.json({
      message: `User verification status updated to ${is_verified ? 'verified' : 'unverified'}`,
      data: user,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      return res.status(statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;