import { Request, Response, NextFunction } from 'express';
import { validationResult, matchedData } from 'express-validator';
import { Prisma } from '@prisma/client';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors
    });
  }

  // Add validated data to request for clean access in controllers
  req.validatedData = matchedData(req);
  next();
};

export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      error: 'Invalid pagination parameters',
      details: 'Page must be >= 1, limit must be between 1 and 100'
    });
  }

  req.pagination = { page, limit, offset };
  next();
};

// Custom validation for Prisma unique constraint errors
export const handlePrismaErrors = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      const field = error.meta?.target as string[];
      return res.status(409).json({
        error: 'Resource already exists',
        details: `${field.join(', ')} must be unique`
      });
    }

    // Handle foreign key constraint
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'Invalid reference',
        details: 'The referenced resource does not exist'
      });
    }

    // Handle record not found
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Resource not found',
        details: 'The requested resource does not exist'
      });
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