import { describe, it, expect } from '@jest/globals';

describe('Utils: Common utility functions', () => {
  describe('Email validation', () => {
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('should validate correct email format', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email format', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('Password validation', () => {
    const isValidPassword = (password: string): boolean => {
      return password.length >= 8 &&
             /[A-Z]/.test(password) &&
             /[a-z]/.test(password) &&
             /[0-9]/.test(password) &&
             /[!@#$%^&*]/.test(password);
    };

    it('should validate strong passwords', () => {
      expect(isValidPassword('SecurePass123!')).toBe(true);
      expect(isValidPassword('MyPassword@123')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(isValidPassword('weak')).toBe(false);
      expect(isValidPassword('12345678')).toBe(false);
      expect(isValidPassword('NoNumbers!')).toBe(false);
      expect(isValidPassword('nospecial123')).toBe(false);
    });
  });

  describe('UUID validation', () => {
    const isValidUUID = (uuid: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(uuid);
    };

    it('should validate correct UUID format', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
    });
  });

  describe('SKU validation', () => {
    const isValidSKU = (sku: string): boolean => {
      return /^[A-Z0-9\-]+$/.test(sku) && sku.length >= 3 && sku.length <= 20;
    };

    it('should validate correct SKU format', () => {
      expect(isValidSKU('PROD-001')).toBe(true);
      expect(isValidSKU('SKU123')).toBe(true);
      expect(isValidSKU('ITEM-2024-001')).toBe(true);
    });

    it('should reject invalid SKU format', () => {
      expect(isValidSKU('ab')).toBe(false);
      expect(isValidSKU('sku-with-lowercase')).toBe(false);
      expect(isValidSKU('123456789012345678901')).toBe(false);
    });
  });

  describe('Numeric utilities', () => {
    describe('formatPrice', () => {
      const formatPrice = (price: number): string => {
        return `$${(price / 100).toFixed(2)}`;
      };

      it('should format price in cents to dollars', () => {
        expect(formatPrice(1000)).toBe('$10.00');
        expect(formatPrice(1999)).toBe('$19.99');
        expect(formatPrice(100)).toBe('$1.00');
      });
    });

    describe('calculateDiscount', () => {
      const calculateDiscount = (original: number, discount: number): number => {
        return Math.round(original * (1 - discount / 100));
      };

      it('should calculate discount correctly', () => {
        expect(calculateDiscount(1000, 10)).toBe(900);
        expect(calculateDiscount(5000, 20)).toBe(4000);
      });
    });
  });

  describe('Array utilities', () => {
    describe('chunk', () => {
      const chunk = <T,>(arr: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      it('should split array into chunks', () => {
        const result = chunk([1, 2, 3, 4, 5], 2);
        expect(result).toEqual([[1, 2], [3, 4], [5]]);
      });
    });

    describe('unique', () => {
      const unique = <T,>(arr: T[]): T[] => {
        return [...new Set(arr)];
      };

      it('should remove duplicates', () => {
        expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
      });
    });
  });
});
