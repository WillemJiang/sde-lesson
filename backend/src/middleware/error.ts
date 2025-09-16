import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { statusCode = 500, message } = error;

  // Log error for debugging
  console.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(error, req, res);
    return;
  }

  if (error instanceof Stripe.errors.StripeError) {
    handleStripeError(error, req, res);
    return;
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Invalid request data';
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    message = 'Invalid JSON in request body';
  }

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response = {
    error: message,
    ...(isDevelopment && { stack: error.stack }),
    ...(isDevelopment && { details: error }),
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(response);
};

const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError, req: Request, res: Response) => {
  switch (error.code) {
    case 'P2002':
      res.status(409).json({
        error: 'Resource already exists',
        details: `Unique constraint failed on field(s): ${error.meta?.target}`
      });
      break;

    case 'P2003':
      res.status(400).json({
        error: 'Invalid reference',
        details: 'Foreign key constraint failed'
      });
      break;

    case 'P2025':
      res.status(404).json({
        error: 'Resource not found',
        details: 'Record does not exist'
      });
      break;

    case 'P2001':
      res.status(400).json({
        error: 'Constraint violation',
        details: 'Data violates database constraints'
      });
      break;

    default:
      res.status(500).json({
        error: 'Database error',
        details: 'An unexpected database error occurred'
      });
  }
};

const handleStripeError = (error: Stripe.errors.StripeError, req: Request, res: Response) => {
  if (error instanceof Stripe.errors.StripeCardError) {
    res.status(400).json({
      error: 'Payment failed',
      details: error.message
    });
  } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    res.status(400).json({
      error: 'Invalid payment request',
      details: error.message
    });
  } else if (error instanceof Stripe.errors.StripeAPIError) {
    res.status(502).json({
      error: 'Payment service error',
      details: 'External payment service unavailable'
    });
  } else {
    res.status(500).json({
      error: 'Payment processing error',
      details: 'An unexpected error occurred during payment processing'
    });
  }
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    details: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
};