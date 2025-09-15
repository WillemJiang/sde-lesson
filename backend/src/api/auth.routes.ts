import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService, RegisterInput, LoginInput } from '../lib/auth/AuthService';

const router = Router();
const authService = new AuthService();

// Register endpoint
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const registerInput: RegisterInput = {
      email: req.body.email,
      password: req.body.password,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
    };

    const result = await authService.register(registerInput);

    res.status(201).json({
      message: 'User registered successfully. Please check your email for verification.',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Email already registered') {
        res.status(409).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const loginInput: LoginInput = {
      email: req.body.email,
      password: req.body.password,
    };

    const result = await authService.login(loginInput);

    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Invalid credentials') {
        res.status(401).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify email endpoint
router.post('/verify', [
  body('token').notEmpty().withMessage('Verification token is required'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { token } = req.body;
    const user = await authService.verifyEmail(token);

    res.json({
      message: 'Email verified successfully',
      user,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Invalid verification token') {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;