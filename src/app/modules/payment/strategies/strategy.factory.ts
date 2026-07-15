import httpStatus from "http-status";
import ApiError from "../../../../errors/ApiErrors.js";
import { PaymentProvider } from "../../../../generated/prisma/client.js";
import { BkashStrategy } from "./bkash.strategy.js";
import { PaymentStrategy } from "./payment.strategy.js";
import { StripeStrategy } from "./stripe.strategy.js";

class PaymentStrategyFactory {
  private strategies = new Map<PaymentProvider, PaymentStrategy>();

  constructor() {
    this.register(new StripeStrategy());
    this.register(new BkashStrategy());
  }

  register(strategy: PaymentStrategy): void {
    this.strategies.set(strategy.provider, strategy);
  }

  get(provider: PaymentProvider): PaymentStrategy {
    const strategy = this.strategies.get(provider);
    if (!strategy) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Unsupported payment provider: ${provider}`,
      );
    }
    return strategy;
  }
}

export const paymentStrategyFactory = new PaymentStrategyFactory();
