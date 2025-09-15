import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PaymentService, CreatePaymentIntentInput, ConfirmPaymentInput } from '../lib/payment/PaymentService';

const router = Router();
const paymentService = new PaymentService();

// Create payment intent
router.post('/create-payment-intent', [
  body('order_id').isUUID().withMessage('Invalid order ID'),
  body('payment_method').isIn(['card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const input: CreatePaymentIntentInput = {
      order_id: req.body.order_id,
      payment_method: req.body.payment_method,
    };

    const result = await paymentService.createPaymentIntent(input);

    res.status(201).json({
      message: 'Payment intent created successfully',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('already exists') ? 409 :
                       error.message.includes('payable state') ? 400 : 400;
      return res.status(statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Confirm payment
router.post('/:id/confirm', [
  param('id').isUUID().withMessage('Invalid payment ID'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const input: ConfirmPaymentInput = {
      payment_intent_id: id,
    };

    const payment = await paymentService.confirmPayment(input);

    res.json({
      message: 'Payment confirmed successfully',
      data: payment,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      return res.status(statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment by ID
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid payment ID'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const payment = await paymentService.getPaymentById(id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      message: 'Payment retrieved successfully',
      data: payment,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment by order ID
router.get('/order/:orderId', [
  param('orderId').isUUID().withMessage('Invalid order ID'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;
    const payment = await paymentService.getPaymentByOrderId(orderId);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found for this order' });
    }

    res.json({
      message: 'Payment retrieved successfully',
      data: payment,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refund payment
router.post('/:id/refund', [
  param('id').isUUID().withMessage('Invalid payment ID'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const amount = req.body.amount ? parseFloat(req.body.amount) : undefined;

    const payment = await paymentService.refundPayment(id, amount);

    res.json({
      message: 'Payment refunded successfully',
      data: payment,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('refundable state') ? 400 : 400;
      return res.status(statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Retry payment
router.post('/:id/retry', [
  param('id').isUUID().withMessage('Invalid payment ID'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const result = await paymentService.retryPayment(id);

    res.json({
      message: 'Payment retry initiated successfully',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('retryable state') ? 400 : 400;
      return res.status(statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const stats = await paymentService.getPaymentStats();

    res.json({
      message: 'Payment statistics retrieved successfully',
      data: stats,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stripe webhook handler
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Stripe signature is required' });
    }

    await paymentService.handleWebhook(req.body, signature);

    res.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('signature verification') ? 400 : 500;
      return res.status(statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;