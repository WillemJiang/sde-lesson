import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthService } from '../../src/lib/auth/AuthService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

import { prisma } from '../../src/config/database';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt', async () => {
      const password = 'SecurePassword123!';
      const hashedPassword = 'hashed_password_hash';

      (bcrypt.hash as any).mockResolvedValueOnce(hashedPassword);

      const result = await authService.hashPassword(password);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });

    it('should handle hash errors', async () => {
      (bcrypt.hash as any).mockRejectedValueOnce(new Error('Hash failed'));

      await expect(authService.hashPassword('password')).rejects.toThrow('Hash failed');
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching passwords', async () => {
      const password = 'SecurePassword123!';
      const hash = 'hashed_password_hash';

      (bcrypt.compare as any).mockResolvedValueOnce(true);

      const result = await authService.verifyPassword(password, hash);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching passwords', async () => {
      (bcrypt.compare as any).mockResolvedValueOnce(false);

      const result = await authService.verifyPassword('wrong', 'hash');

      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token', () => {
      const userId = 'user-123';
      const token = 'jwt_token_string';

      (jwt.sign as any).mockReturnValueOnce(token);

      const result = authService.generateToken(userId);

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId },
        expect.any(String),
        expect.objectContaining({
          expiresIn: expect.any(String),
        })
      );
      expect(result).toBe(token);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = 'valid_token';
      const decoded = { userId: 'user-123' };

      (jwt.verify as any).mockReturnValueOnce(decoded);

      const result = authService.verifyToken(token);

      expect(result).toEqual(decoded);
    });

    it('should return null for invalid token', () => {
      (jwt.verify as any).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const result = authService.verifyToken('invalid_token');

      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('should create new user and return user with token', async () => {
      const input = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        first_name: 'John',
        last_name: 'Doe',
      };

      const hashedPassword = 'hashed_password';
      const createdUser = {
        id: 'user-123',
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
        is_verified: false,
      };

      (prisma.user.findUnique as any).mockResolvedValueOnce(null);
      (bcrypt.hash as any).mockResolvedValueOnce(hashedPassword);
      (prisma.user.create as any).mockResolvedValueOnce(createdUser);
      (jwt.sign as any).mockReturnValueOnce('jwt_token');

      const result = await authService.register(input);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: input.email },
      });
      expect(result.user).toEqual(createdUser);
      expect(result.token).toBeDefined();
    });

    it('should throw error if email already exists', async () => {
      const input = {
        email: 'existing@example.com',
        password: 'Password123!',
        first_name: 'John',
        last_name: 'Doe',
      };

      (prisma.user.findUnique as any).mockResolvedValueOnce({ id: 'user-456' });

      await expect(authService.register(input)).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should return user and token for valid credentials', async () => {
      const input = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
      };

      const user = {
        id: 'user-123',
        email: input.email,
        first_name: 'John',
        last_name: 'Doe',
        password_hash: 'hashed_password',
        is_verified: true,
      };

      (prisma.user.findUnique as any).mockResolvedValueOnce(user);
      (bcrypt.compare as any).mockResolvedValueOnce(true);
      (jwt.sign as any).mockReturnValueOnce('jwt_token');

      const result = await authService.login(input);

      expect(result.user).not.toHaveProperty('password_hash');
      expect(result.token).toBeDefined();
    });

    it('should throw error for invalid credentials', async () => {
      (prisma.user.findUnique as any).mockResolvedValueOnce(null);

      await expect(authService.login({
        email: 'nonexistent@example.com',
        password: 'Password123!',
      })).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for wrong password', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'correct_hash',
      };

      (prisma.user.findUnique as any).mockResolvedValueOnce(user);
      (bcrypt.compare as any).mockResolvedValueOnce(false);

      await expect(authService.login({
        email: 'test@example.com',
        password: 'WrongPassword123!',
      })).rejects.toThrow('Invalid credentials');
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and update user', async () => {
      const token = 'verification_token_123';
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        is_verified: false,
      };

      const updatedUser = {
        ...user,
        is_verified: true,
      };

      (prisma.user.findFirst as any).mockResolvedValueOnce(user);
      (prisma.user.update as any).mockResolvedValueOnce(updatedUser);

      const result = await authService.verifyEmail(token);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          is_verified: true,
          verification_token: null,
        },
        select: expect.any(Object),
      });
      expect(result.is_verified).toBe(true);
    });

    it('should throw error for invalid token', async () => {
      (prisma.user.findFirst as any).mockResolvedValueOnce(null);

      await expect(authService.verifyEmail('invalid_token')).rejects.toThrow('Invalid verification token');
    });
  });

  describe('getCurrentUser', () => {
    it('should return user by ID', async () => {
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'test@example.com',
        first_name: 'John',
      };

      (prisma.user.findUnique as any).mockResolvedValueOnce(user);

      const result = await authService.getCurrentUser(userId);

      expect(result).toEqual(user);
    });

    it('should return null if user not found', async () => {
      (prisma.user.findUnique as any).mockResolvedValueOnce(null);

      const result = await authService.getCurrentUser('nonexistent');

      expect(result).toBeNull();
    });
  });
});
