import httpStatus from "http-status";
import Stripe from "stripe";
import config from "../../../../config/index.js";
import ApiError from "../../../../errors/ApiErrors.js";
import {
  PaymentProvider,
  PaymentStatus,
} from "../../../../generated/prisma/client.js";
import {
  CallbackMeta,
  CallbackResult,
  InitiateResult,
  OrderForPayment,
  PaymentStrategy,
  VerifyResult,
} from "./payment.strategy.js";

export class StripeStrategy implements PaymentStrategy {
  readonly provider = PaymentProvider.stripe;

  private client: Stripe | null;

  constructor(client?: Stripe) {
    this.client = client ?? null;
  }

  private getClient(): Stripe {
    if (!this.client) {
      if (!config.stripe.enabled) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Stripe payments are not enabled on this server",
        );
      }
      this.client = new Stripe(config.stripe.secret_key as string);
    }
    return this.client;
  }

  async initiate(order: OrderForPayment): Promise<InitiateResult> {
    const intent = await this.getClient().paymentIntents.create({
      amount: order.totalAmount,
      currency: config.stripe.currency,
      automatic_payment_methods: { enabled: true },
      metadata: { orderId: order.id, paymentId: order.paymentId },
    });

    return {
      transactionId: intent.id,
      rawResponse: intent,
      clientPayload: {
        clientSecret: intent.client_secret,
        transactionId: intent.id,
      },
    };
  }

  async verify(transactionId: string): Promise<VerifyResult> {
    const intent =
      await this.getClient().paymentIntents.retrieve(transactionId);
    return { status: this.mapIntentStatus(intent.status), rawResponse: intent };
  }

  async handleCallback(meta: CallbackMeta): Promise<CallbackResult | null> {
    const signature = meta.headers?.["stripe-signature"];
    if (!meta.rawBody || typeof signature !== "string") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Missing Stripe signature or body",
      );
    }

    let event: Stripe.Event;
    try {
      event = this.getClient().webhooks.constructEvent(
        meta.rawBody,
        signature,
        config.stripe.webhook_secret as string,
      );
    } catch {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid Stripe webhook signature",
      );
    }

    if (
      event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const intent = event.data.object as Stripe.PaymentIntent;
      return {
        transactionId: intent.id,
        status:
          event.type === "payment_intent.succeeded"
            ? PaymentStatus.success
            : PaymentStatus.failed,
        rawResponse: event,
      };
    }

    return null;
  }

  private mapIntentStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
    if (status === "succeeded") return PaymentStatus.success;
    if (status === "canceled") return PaymentStatus.failed;
    return PaymentStatus.pending;
  }
}
