import Stripe from 'stripe';
import { prisma } from '../../config/database';
import { Payment, PaymentStatus } from '../../models';
import { isAdminEmail } from '../../middleware/admin';

export interface CreatePaymentIntentInput {
  order_id: string;
  payment_method: string;
}

export interface ConfirmPaymentInput {
  payment_intent_id: string;
}

export interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
}

export class PaymentService {
  private stripe: Stripe;

  constructor() {
    // Use mock Stripe in test environment
    if (process.env.NODE_ENV === 'test') {
      this.stripe = {
        paymentIntents: {
          create: async (params: any) => ({
            id: `pi_test_${Math.random().toString(36).substring(7)}`,
            client_secret: `pi_test_${Math.random().toString(36).substring(7)}_secret_${Math.random().toString(36).substring(7)}`,
            amount: params.amount,
            currency: params.currency,
            metadata: params.metadata,
            status: 'requires_payment_method'
          }),
          retrieve: async (id: string) => ({
            id: id,
            status: 'succeeded',
            amount: 10000,
            currency: 'usd'
          })
        },
        refunds: {
          create: async (params: any) => ({
            id: `re_test_${Math.random().toString(36).substring(7)}`,
            amount: params.amount,
            status: 'succeeded'
          })
        },
        webhooks: {
          constructEvent: (payload: any, signature: any, secret: any) => ({
            type: 'payment_intent.succeeded',
            data: {
              object: {
                id: `pi_test_${Math.random().toString(36).substring(7)}`,
                status: 'succeeded',
                amount: 10000,
                currency: 'usd'
              }
            }
          })
        }
      } as any;
    } else {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-08-27.basil' as any,
      });
    }
  }

  async createPaymentIntent(input: CreatePaymentIntentInput, userId?: string, userEmail?: string): Promise<PaymentIntentResponse> {
    const order = await prisma.order.findUnique({
      where: { id: input.order_id },
      include: {
        payment: true,
      },
    });

  
    if (!order) {
      throw new Error('Order not found');
    }

    // Check if the order belongs to the user (unless admin)
    const isAdmin = userEmail && isAdminEmail(userEmail);
    if (userId && order.user_id !== userId && !isAdmin) {
      throw new Error('Order not found');
    }

    if (order.payment) {
      throw new Error('Payment already exists for this order');
    }

    if (order.status !== 'PENDING') {
      throw new Error('Order is not in a payable state');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(order.total_amount * 100),
        currency: 'usd',
        metadata: {
          order_id: order.id,
        },
      });

      await prisma.payment.create({
        data: {
          order_id: order.id,
          stripe_payment_intent_id: paymentIntent.id,
          amount: order.total_amount,
          status: PaymentStatus.PENDING as any,
          payment_method: input.payment_method,
        },
      });

      return {
        client_secret: paymentIntent.client_secret!,
        payment_intent_id: paymentIntent.id,
        amount: order.total_amount,
        currency: 'usd',
      };
    } catch (error) {
      throw new Error(`Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async confirmPayment(input: ConfirmPaymentInput): Promise<Payment> {
    const payment = await prisma.payment.findFirst({
      where: {
        stripe_payment_intent_id: input.payment_intent_id,
      },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(input.payment_intent_id);

      if (paymentIntent.status === 'succeeded') {
        const updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCEEDED as any,
          },
        });

        await prisma.order.update({
          where: { id: payment.order_id },
          data: {
            status: 'PROCESSING',
          },
        });

        return updatedPayment;
      } else {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED as any,
          },
        });

        throw new Error('Payment failed');
      }
    } catch (error) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED as any,
        },
      });

      throw new Error('Failed to confirm payment');
    }
  }

  async getPaymentByOrderId(order_id: string): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { order_id },
    });
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { id },
    });
  }

  async refundPayment(payment_id: string, amount?: number): Promise<Payment> {
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.SUCCEEDED as any) {
      throw new Error('Payment is not in a refundable state');
    }

    try {
      const refundAmount = amount ? Math.round(amount * 100) : Math.round(payment.amount * 100);

      await this.stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: refundAmount,
      });

      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED as any,
        },
      });

      return updatedPayment;
    } catch (error) {
      throw new Error('Failed to process refund');
    }
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      throw new Error('Webhook signature verification failed');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await prisma.payment.findFirst({
      where: {
        stripe_payment_intent_id: paymentIntent.id,
      },
    });

    if (!payment) {
      console.error('Payment not found for payment intent:', paymentIntent.id);
      return;
    }

    await Promise.all([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED as any,
        },
      }),
      prisma.order.update({
        where: { id: payment.order_id },
        data: {
          status: 'PROCESSING',
        },
      }),
    ]);
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await prisma.payment.findFirst({
      where: {
        stripe_payment_intent_id: paymentIntent.id,
      },
    });

    if (!payment) {
      console.error('Payment not found for payment intent:', paymentIntent.id);
      return;
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED as any,
      },
    });
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const paymentIntentId = charge.payment_intent as string;

    const payment = await prisma.payment.findFirst({
      where: {
        stripe_payment_intent_id: paymentIntentId,
      },
    });

    if (!payment) {
      console.error('Payment not found for charge:', charge.id);
      return;
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REFUNDED as any,
      },
    });
  }

  async getPaymentStats(): Promise<{
    totalRevenue: number;
    successfulPayments: number;
    failedPayments: number;
    refundedPayments: number;
    averagePaymentAmount: number;
  }> {
    const payments = await prisma.payment.findMany();

    const totalRevenue = payments
      .filter(p => p.status === PaymentStatus.SUCCEEDED as any)
      .reduce((sum, p) => sum + p.amount, 0);

    const successfulPayments = payments.filter(p => p.status === PaymentStatus.SUCCEEDED as any).length;
    const failedPayments = payments.filter(p => p.status === PaymentStatus.FAILED as any).length;
    const refundedPayments = payments.filter(p => p.status === PaymentStatus.REFUNDED as any).length;
    const averagePaymentAmount = successfulPayments > 0 ? totalRevenue / successfulPayments : 0;

    return {
      totalRevenue,
      successfulPayments,
      failedPayments,
      refundedPayments,
      averagePaymentAmount,
    };
  }

  async retryPayment(payment_id: string): Promise<PaymentIntentResponse> {
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.FAILED as any) {
      throw new Error('Payment is not in a retryable state');
    }

    try {
      const newPaymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(payment.amount * 100),
        currency: 'usd',
        metadata: {
          order_id: payment.order_id,
        },
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripe_payment_intent_id: newPaymentIntent.id,
          status: PaymentStatus.PENDING as any,
        },
      });

      return {
        client_secret: newPaymentIntent.client_secret!,
        payment_intent_id: newPaymentIntent.id,
        amount: payment.amount,
        currency: 'usd',
      };
    } catch (error) {
      throw new Error('Failed to retry payment');
    }
  }
}