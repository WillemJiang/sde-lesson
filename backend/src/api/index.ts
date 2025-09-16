import { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import express from 'express';

// Import route handlers
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';
import paymentRoutes from './payment.routes';
import userRoutes from './user.routes';
import { authenticateToken } from '../middleware/auth';

// Create the main API router
const apiRouter = Router();

// Apply global middleware
apiRouter.use(helmet());
apiRouter.use(cors());
apiRouter.use(morgan('combined'));
apiRouter.use(express.json({ limit: '10mb' }));
apiRouter.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom middleware for API versioning
apiRouter.use((req, res, next) => {
  res.setHeader('X-API-Version', '1.0.0');
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Custom middleware for request timing
apiRouter.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Custom middleware for error handling
apiRouter.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction): void => {
  console.error('API Error:', err);

  if (err.type === 'entity.parse.failed') {
    res.status(400).json({
      error: 'Invalid JSON payload',
      message: 'The request body contains invalid JSON'
    });
    return;
  }

  if (err.type === 'entity.too.large') {
    res.status(413).json({
      error: 'Payload too large',
      message: 'The request body exceeds the maximum allowed size'
    });
    return;
  }

  // Pass the error to the next error handler
  next(err);
});

// Authentication middleware for protected routes
apiRouter.use((req, res, next) => {
  // Skip authentication for auth routes, health checks, and routes that handle their own auth
  if (req.path.startsWith('/auth') ||
      req.path === '/health' ||
      req.path === '/info') {
    return next();
  }

  // Apply authentication middleware to all other routes
  authenticateToken(req, res, next);
});

// Custom middleware for rate limiting simulation
apiRouter.use((req, res, next) => {
  // In production, implement proper rate limiting
  // For now, we'll just add a rate limit header
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', '99');
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 3600000).toISOString());
  next();
});

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

// API info endpoint
apiRouter.get('/info', (req, res) => {
  res.json({
    name: 'E-Commerce API',
    version: '1.0.0',
    description: 'API for e-commerce website with user authentication, product management, and payment processing',
    endpoints: {
      auth: '/auth/*',
      products: '/products/*',
      cart: '/cart/*',
      orders: '/orders/*',
      payments: '/payments/*',
      users: '/users/*',
    },
    documentation: '/api/v1/docs',
  });
});

// Mount route handlers
apiRouter.use('/auth', authRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/cart', cartRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/users', userRoutes);

// 404 handler for API routes
apiRouter.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    documentation: '/api/v1/docs',
  });
});

// Global error handler
apiRouter.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction): void => {
  console.error('Global error handler:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default apiRouter;