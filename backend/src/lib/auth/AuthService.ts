import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { User, CreateUserInput, UpdateUserInput, userSelect } from '../../models/User';

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface RegisterInput extends CreateUserInput {
  password: string;
}

export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
  private readonly jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
  private readonly saltRounds = 12;

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(userId: string): string {
    return jwt.sign({ userId }, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }

  verifyToken(token: string): { userId: string } | null {
    try {
      return jwt.verify(token, this.jwtSecret) as { userId: string };
    } catch {
      return null;
    }
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const { password, ...userData } = input;

    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const password_hash = await this.hashPassword(password);
    const verification_token = this.generateVerificationToken();

    const user = await prisma.user.create({
      data: {
        ...userData,
        password_hash,
        verification_token,
      },
      select: userSelect,
    });

    const token = this.generateToken(user.id);

    return { user, token };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        ...userSelect,
        password_hash: true,
      },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await this.verifyPassword(input.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const { password_hash, ...userWithoutPassword } = user;
    const token = this.generateToken(user.id);

    return { user: userWithoutPassword as User, token };
  }

  async verifyEmail(token: string): Promise<User> {
    const user = await prisma.user.findFirst({
      where: { verification_token: token },
      select: userSelect,
    });

    if (!user) {
      throw new Error('Invalid verification token');
    }

    if (user.is_verified) {
      return user;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        is_verified: true,
        verification_token: null,
      },
      select: userSelect,
    });

    return updatedUser;
  }

  async getCurrentUser(userId: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    return user || null;
  }

  async updateUser(userId: string, input: UpdateUserInput): Promise<User> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: input,
      select: userSelect,
    });

    return user;
  }

  private generateVerificationToken(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Email not found');
    }

    const resetToken = this.generateVerificationToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { verification_token: resetToken },
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { verification_token: token },
    });

    if (!user) {
      throw new Error('Invalid reset token');
    }

    const password_hash = await this.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        verification_token: null,
      },
    });
  }
}