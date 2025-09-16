import { Request, Response, NextFunction } from 'express';
import { validationResult, matchedData } from 'express-validator';
import { Prisma } from '@prisma/client';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => {
      // Handle different types of validation errors
      if ('param' in error && 'value' in error) {
        return {
          field: error.param,
          message: error.msg,
          value: error.value
        };
      } else {
        // Handle AlternativeValidationError and other types
        return {
          field: 'unknown',
          message: error.msg,
          value: undefined
        };
      }
    });

    res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors
    });
    return;
  }

  // Add validated data to request for clean access in controllers
  req.validatedData = matchedData(req);
  next();
};

export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  if (page < 1 || limit < 1 || limit > 100) {
    res.status(400).json({
      error: 'Invalid pagination parameters',
      details: 'Page must be >= 1, limit must be between 1 and 100'
    });
    return;
  }

  req.pagination = { page, limit, offset };
  next();
};

// Custom validation for Prisma unique constraint errors
export const handlePrismaErrors = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      const field = error.meta?.target as string[];
      res.status(409).json({
        error: 'Resource already exists',
        details: `${field.join(', ')} must be unique`
      });
      return;
    }

    // Handle foreign key constraint
    if (error.code === 'P2003') {
      res.status(400).json({
        error: 'Invalid reference',
        details: 'The referenced resource does not exist'
      });
      return;
    }

    // Handle record not found
    if (error.code === 'P2025') {
      res.status(404).json({
        error: 'Resource not found',
        details: 'The requested resource does not exist'
      });
      return;
    }
  }

  next(error);
};

declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
      pagination?: {
        page: number;
        limit: number;
        offset: number;
      };
    }
  }
}