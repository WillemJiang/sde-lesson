import { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../config/database';
import { logger } from '../config/logging';
import { config } from '../config/env';
import { AppError } from '../middleware/error';

// Initialize Stripe
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-08-27.basil',
});

// Webhook event handlers
const webhookHandlers = {
  'payment_intent.succeeded': handlePaymentIntentSucceeded,
  'payment_intent.payment_failed': handlePaymentIntentFailed,
  'charge.succeeded': handleChargeSucceeded,
  'charge.failed': handleChargeFailed,
  'charge.refunded': handleChargeRefunded,
  'customer.subscription.created': handleSubscriptionCreated,
  'customer.subscription.updated': handleSubscriptionUpdated,
  'customer.subscription.deleted': handleSubscriptionDeleted,
  'invoice.payment_succeeded': handleInvoicePaymentSucceeded,
  'invoice.payment_failed': handleInvoicePaymentFailed,
  'checkout.session.completed': handleCheckoutSessionCompleted,
  'checkout.session.expired': handleCheckoutSessionExpired,
};

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    // Update payment record
    const payment = await prisma.payment.findFirst({
      where: { stripe_payment_intent_id: paymentIntent.id },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
        },
      });
    }

    // Update order status
    const order = await prisma.order.findFirst({
      where: { payment: {
        stripe_payment_intent_id: paymentIntent.id
      }},
    });

    if (order) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PROCESSING',
        },
      });

      // Log business event
      logger.info('Payment completed', {
        paymentIntentId: paymentIntent.id,
        orderId: order.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
    }

    logger.info('Payment intent succeeded', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    });
  } catch (error) {
    logger.error('Error handling payment intent succeeded', {
      paymentIntentId: paymentIntent.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    // Update payment record
    const payment = await prisma.payment.findFirst({
      where: { stripe_payment_intent_id: paymentIntent.id },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
        },
      });
    }

    // Update order status
    const order = await prisma.order.findFirst({
      where: { payment: {
        stripe_payment_intent_id: paymentIntent.id
      }},
    });

    if (order) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
        },
      });
    }

    logger.warn('Payment intent failed', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      lastPaymentError: paymentIntent.last_payment_error?.message,
    });
  } catch (error) {
    logger.error('Error handling payment intent failed', {
      paymentIntentId: paymentIntent.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function handleChargeSucceeded(charge: Stripe.Charge) {
  try {
    logger.info('Charge succeeded', {
      chargeId: charge.id,
      paymentIntentId: charge.payment_intent,
      amount: charge.amount,
    });
  } catch (error) {
    logger.error('Error handling charge succeeded', {
      chargeId: charge.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleChargeFailed(charge: Stripe.Charge) {
  try {
    logger.warn('Charge failed', {
      chargeId: charge.id,
      paymentIntentId: charge.payment_intent,
      amount: charge.amount,
      failureReason: charge.failure_message,
    });
  } catch (error) {
    logger.error('Error handling charge failed', {
      chargeId: charge.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  try {
    // Update payment record
    const payment = await prisma.payment.findFirst({
      where: { stripe_payment_intent_id: charge.payment_intent as string },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'REFUNDED',
        },
      });
    }

    // Update order status
    const paymentRecord = await prisma.payment.findFirst({
      where: { stripe_payment_intent_id: charge.payment_intent as string },
    });

    if (paymentRecord) {
      const order = await prisma.order.findFirst({
        where: { payment: {
          id: paymentRecord.id
        }},
      });

      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
          },
        });
      }
    }

    logger.info('Charge refunded', {
      chargeId: charge.id,
      amountRefunded: charge.amount_refunded,
    });
  } catch (error) {
    logger.error('Error handling charge refunded', {
      chargeId: charge.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  try {
    logger.info('Subscription created', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
    });
  } catch (error) {
    logger.error('Error handling subscription created', {
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    logger.info('Subscription updated', {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: (subscription as any).current_period_end as number | null,
    });
  } catch (error) {
    logger.error('Error handling subscription updated', {
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    logger.info('Subscription deleted', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
    });
  } catch (error) {
    logger.error('Error handling subscription deleted', {
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    logger.info('Invoice payment succeeded', {
      invoiceId: invoice.id,
      subscriptionId: (invoice as any).subscription as string | null,
      amount: invoice.amount_paid,
    });
  } catch (error) {
    logger.error('Error handling invoice payment succeeded', {
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    logger.warn('Invoice payment failed', {
      invoiceId: invoice.id,
      subscriptionId: (invoice as any).subscription as string | null,
      amount: invoice.amount_due,
    });
  } catch (error) {
    logger.error('Error handling invoice payment failed', {
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    logger.info('Checkout session completed', {
      sessionId: session.id,
      customerId: session.customer,
      paymentIntentId: session.payment_intent,
    });
  } catch (error) {
    logger.error('Error handling checkout session completed', {
      sessionId: session.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  try {
    logger.info('Checkout session expired', {
      sessionId: session.id,
      customerId: session.customer,
    });
  } catch (error) {
    logger.error('Error handling checkout session expired', {
      sessionId: session.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Main webhook handler
export const handleStripeWebhook = async (req: Request, res: Response): Promise<any> => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret
    );
  } catch (err) {
    logger.error('Webhook signature verification failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
      signature: sig,
    });
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Log the received event
  logger.info('Webhook event received', {
    type: event.type,
    id: event.id,
    created: event.created,
  });

  // Handle the event
  try {
    const handler = webhookHandlers[event.type as keyof typeof webhookHandlers];

    if (handler) {
      await handler(event.data.object as any);
    } else {
      logger.warn('Unhandled webhook event type', {
        type: event.type,
        id: event.id,
      });
    }

    // Return success response
    res.json({ received: true });
  } catch (error) {
    logger.error('Error handling webhook event', {
      type: event.type,
      id: event.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Still return 200 to prevent Stripe from retrying
    res.status(200).json({ received: true, error: 'Processing failed' });
  }
};

// Webhook endpoint configuration
export const stripeWebhookConfig = {
  path: '/api/v1/webhooks/stripe',
  rawBody: true,
};

// Utility function to construct webhook events for testing
export const constructTestEvent = (payload: any, signature: string): Stripe.Event => {
  return stripe.webhooks.constructEvent(
    JSON.stringify(payload),
    signature,
    config.stripe.webhookSecret
  );
};

// Test webhook endpoint (only in development)
export const testWebhook = async (req: Request, res: Response): Promise<any> => {
  if (config.app.env !== 'development') {
    return res.status(403).json({ error: 'Test webhook only available in development' });
  }

  const { eventType, payload } = req.body;

  try {
    const handler = webhookHandlers[eventType as keyof typeof webhookHandlers];

    if (handler) {
      await handler(payload);
      res.json({ success: true, message: `Test event ${eventType} processed` });
    } else {
      res.status(400).json({ error: `No handler for event type: ${eventType}` });
    }
  } catch (error) {
    logger.error('Error processing test webhook', {
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to process test webhook' });
  }
};