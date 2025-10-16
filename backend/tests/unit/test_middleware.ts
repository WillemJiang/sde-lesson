import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { handleValidationErrors, validatePagination, handlePrismaErrors } from '../../src/middleware/validation';
import { Prisma } from '@prisma/client';

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
  matchedData: jest.fn(() => ({})),
}));

describe('Middleware: handleValidationErrors', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {} as any;
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;
    next = jest.fn();
  });

  it('should call next() when there are no validation errors', () => {
    (validationResult as any).mockReturnValueOnce({
      isEmpty: () => true,
    });

    handleValidationErrors(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 400 with error details when validation fails', () => {
    const mockErrors = {
      isEmpty: () => false,
      array: () => [
        {
          param: 'email',
          msg: 'Invalid email',
          value: 'invalid-email',
        },
      ],
    };

    (validationResult as any).mockReturnValueOnce(mockErrors);

    handleValidationErrors(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed',
      })
    );
  });
});

describe('Middleware: validatePagination', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      query: {},
    } as any;
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;
    next = jest.fn();
  });

  it('should set default pagination values', () => {
    validatePagination(req as Request, res as Response, next);

    expect(req.pagination).toEqual({ page: 1, limit: 10, offset: 0 });
    expect(next).toHaveBeenCalled();
  });

  it('should calculate offset correctly', () => {
    req.query = { page: '2', limit: '20' };

    validatePagination(req as Request, res as Response, next);

    expect(req.pagination).toEqual({ page: 2, limit: 20, offset: 20 });
    expect(next).toHaveBeenCalled();
  });

  it('should return 400 for invalid page number', () => {
    req.query = { page: '0' };

    validatePagination(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid pagination parameters',
      })
    );
  });

  it('should return 400 for limit > 100', () => {
    req.query = { limit: '101' };

    validatePagination(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('Middleware: handlePrismaErrors', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {} as any;
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;
    next = jest.fn();
  });

  it('should handle P2002 (unique constraint) error', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '1.0.0',
      meta: { target: ['email'] },
    });

    handlePrismaErrors(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Resource already exists',
      })
    );
  });

  it('should handle P2025 (record not found) error', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '1.0.0',
    });

    handlePrismaErrors(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should pass through non-Prisma errors', () => {
    const error = new Error('Some other error');

    handlePrismaErrors(error, req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
