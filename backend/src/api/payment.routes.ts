import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PaymentService, CreatePaymentIntentInput, ConfirmPaymentInput } from '../lib/payment/PaymentService';

const router = Router();
const paymentService = new PaymentService();

// Create payment intent
router.post('/create-payment-intent', [
  body('order_id').isUUID().withMessage('Invalid order ID'),
  body('payment_method').isIn(['card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
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
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Confirm payment
router.post('/:id/confirm', [
  param('id').isUUID().withMessage('Invalid payment ID'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Payment ID is required' });
      return;
    }
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
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment by ID
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid payment ID'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Payment ID is required' });
      return;
    }
    const payment = await paymentService.getPaymentById(id);

    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    res.json({
      message: 'Payment retrieved successfully',
      data: payment,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment by order ID
router.get('/order/:orderId', [
  param('orderId').isUUID().withMessage('Invalid order ID'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const { orderId } = req.params;
    if (!orderId) {
      res.status(400).json({ error: 'Order ID is required' });
      return;
    }
    const payment = await paymentService.getPaymentByOrderId(orderId);

    if (!payment) {
      res.status(404).json({ error: 'Payment not found for this order' });
    return;
    }

    res.json({
      message: 'Payment retrieved successfully',
      data: payment,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refund payment
router.post('/:id/refund', [
  param('id').isUUID().withMessage('Invalid payment ID'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Payment ID is required' });
      return;
    }
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
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Retry payment
router.post('/:id/retry', [
  param('id').isUUID().withMessage('Invalid payment ID'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
    return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Payment ID is required' });
      return;
    }
    const result = await paymentService.retryPayment(id);

    res.json({
      message: 'Payment retry initiated successfully',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('retryable state') ? 400 : 400;
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment statistics
router.get('/stats/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await paymentService.getPaymentStats();

    res.json({
      message: 'Payment statistics retrieved successfully',
      data: stats,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stripe webhook handler
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      res.status(400).json({ error: 'Stripe signature is required' });
    return;
    }

    await paymentService.handleWebhook(req.body, signature);

    res.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    if (error instanceof Error) {
      const statusCode = error.message.includes('signature verification') ? 400 : 500;
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;