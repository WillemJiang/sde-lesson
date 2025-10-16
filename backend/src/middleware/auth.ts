import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';

interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      // Enhanced error message for debugging test failures
      const isTestEnvironment = process.env.NODE_ENV === 'test';
      if (isTestEnvironment) {
        console.log(`Authentication failed: User not found for ID ${decoded.userId}. This may indicate a test cleanup issue.`);
      }
      res.status(401).json({ error: 'Invalid user' });
      return;
    }

    // Attach both decoded token and user info to request
    req.user = {
      userId: decoded.userId,
      email: user.email
    };
    next();
  } catch (error) {
    // Enhanced error logging for test debugging
    const isTestEnvironment = process.env.NODE_ENV === 'test';
    if (isTestEnvironment) {
      console.log(`Authentication failed: Invalid or expired token. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true }
      });

      if (user) {
        req.user = {
          ...decoded,
          email: user.email
        };
      }
    } catch (error) {
      // Token is invalid, but we continue without authentication
    }
  }

  next();
};