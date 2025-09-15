import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ProductService } from '../lib/product/ProductService';
import { ProductFilters, ProductQueryOptions } from '../models/Product';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();
const productService = new ProductService();

// Get all products with pagination and filtering
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['name', 'price', 'created_at']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('category').optional().isString(),
  query('search').optional().isString(),
  query('min_price').optional().isFloat({ min: 0 }).withMessage('Min price must be a positive number'),
  query('max_price').optional().isFloat({ min: 0 }).withMessage('Max price must be a positive number'),
  query('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const options: ProductQueryOptions = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      sortBy: (req.query.sortBy as 'name' | 'price' | 'created_at') || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    };

    if (req.query.category) {
      options.filters = { category: req.query.category as string };
    }
    if (req.query.search) {
      options.filters = { ...options.filters, search: req.query.search as string };
    }
    if (req.query.min_price) {
      options.filters = { ...options.filters, min_price: parseFloat(req.query.min_price as string) };
    }
    if (req.query.max_price) {
      options.filters = { ...options.filters, max_price: parseFloat(req.query.max_price as string) };
    }
    if (req.query.is_active !== undefined) {
      options.filters = { ...options.filters, is_active: req.query.is_active === 'true' };
    }

    const result = await productService.getProducts(options);

    res.json({
      message: 'Products retrieved successfully',
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

// Create a new product
router.post('/', [
  authenticateToken,
  requireAdmin,
  body('name').notEmpty().withMessage('Product name is required'),
  body('description').optional().isString(),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('sku').notEmpty().withMessage('SKU is required'),
  body('stock_quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
  body('category').optional().isString(),
  body('image_url').optional().isURL().withMessage('Image URL must be a valid URL'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const productData = {
      name: req.body.name,
      description: req.body.description || null,
      price: parseFloat(req.body.price),
      sku: req.body.sku,
      stock_quantity: parseInt(req.body.stock_quantity),
      category: req.body.category || null,
      image_url: req.body.image_url || null,
      is_active: req.body.is_active !== undefined ? req.body.is_active : true,
    };

    const product = await productService.createProduct(productData);

    res.status(201).json({
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Product with this SKU already exists') {
        res.status(409).json({ error: error.message });
      return;
      }
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific product by ID
router.get('/:id', [
  param('id').matches(/^[a-z0-9]+$/).withMessage('Invalid product ID format'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }
    const product = await productService.getProductById(id);

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
    return;
    }

    res.json({
      message: 'Product retrieved successfully',
      data: product,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a product
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  param('id').matches(/^[a-z0-9]+$/).withMessage('Invalid product ID format'),
  body('name').optional().notEmpty().withMessage('Product name cannot be empty'),
  body('description').optional().isString(),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('sku').optional().notEmpty().withMessage('SKU cannot be empty'),
  body('stock_quantity').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
  body('category').optional().isString(),
  body('image_url').optional().isURL().withMessage('Image URL must be a valid URL'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }
    const updateData: any = {};

    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.price !== undefined) updateData.price = parseFloat(req.body.price);
    if (req.body.sku !== undefined) updateData.sku = req.body.sku;
    if (req.body.stock_quantity !== undefined) updateData.stock_quantity = parseInt(req.body.stock_quantity);
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.image_url !== undefined) updateData.image_url = req.body.image_url;
    if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active;

    const product = await productService.updateProduct(id, updateData);

    res.json({
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Product not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message === 'Product with this SKU already exists') {
        res.status(409).json({ error: error.message });
      return;
      }
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a product
router.delete('/:id', [
  authenticateToken,
  requireAdmin,
  param('id').matches(/^[a-z0-9]+$/).withMessage('Invalid product ID format'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }
    await productService.deleteProduct(id);

    res.status(204).send();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Product not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;