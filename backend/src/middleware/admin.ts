import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

// List of admin emails - in a real app, this would be stored in the database
const ADMIN_EMAILS = [
  'admin-delete@example.com',
  'admin@example.com',
  'admin-update@example.com',
  'admin-post@example.com',
  'admin-get@example.com',
  'admin-cart-delete@example.com',
  'admin-cart@example.com',
  'admin-cart-items@example.com',
  'admin-cart-update@example.com'
];

export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { email: true }
  });

  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
};