import crypto from "crypto";
import httpStatus from "http-status";
import config from "../../../config/index.js";
import ApiError from "../../../errors/ApiErrors.js";
import { paginationHelper } from "../../../helpers/paginationHelper.js";
import { IPaginationOptions } from "../../../interfaces/paginations.js";
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ProductStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { paymentStrategyFactory } from "./strategies/strategy.factory.js";
import { CallbackMeta } from "./strategies/payment.strategy.js";

interface IRequester {
  id: string;
  role: string;
}

interface IPaymentFilters {
  status?: string;
  provider?: string;
  orderId?: string;
}

class StockShortfallError extends Error {
  constructor(public readonly productIds: string[]) {
    super(`Stock shortfall for products: ${productIds.join(", ")}`);
  }
}

const PAYMENT_INCLUDE = {
  order: {
    select: {
      id: true,
      userId: true,
      status: true,
      totalAmount: true,
      currency: true,
    },
  },
} satisfies Prisma.PaymentInclude;

class PaymentService {
  async initiate(
    requester: IRequester,
    payload: { orderId: string; provider: PaymentProvider },
  ) {
    const order = await prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        items: { select: { productId: true, quantity: true } },
        payments: { select: { id: true, status: true } },
      },
    });

    if (
      !order ||
      (requester.role !== "ADMIN" && order.userId !== requester.id)
    ) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }
    if (order.status !== OrderStatus.pending) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Payments can only be initiated for pending orders (current status: ${order.status})`,
      );
    }
    if (order.payments.some((p) => p.status === PaymentStatus.success)) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "This order already has a successful payment",
      );
    }

    await this.assertItemsStillAvailable(order.items);

    const strategy = paymentStrategyFactory.get(payload.provider);

    const paymentId = crypto.randomUUID();
    const initiation = await strategy.initiate({
      id: order.id,
      paymentId,
      userId: order.userId,
      totalAmount: order.totalAmount,
      currency: order.currency,
    });

    const payment = await prisma.payment.create({
      data: {
        id: paymentId,
        orderId: order.id,
        provider: payload.provider,
        transactionId: initiation.transactionId,
        status: PaymentStatus.pending,
        rawResponse: initiation.rawResponse as Prisma.InputJsonValue,
      },
    });

    return {
      paymentId: payment.id,
      orderId: order.id,
      provider: payload.provider,
      amount: order.totalAmount,
      currency: order.currency,
      ...initiation.clientPayload,
    };
  }

  async settle(
    transactionId: string,
    status: PaymentStatus,
    rawResponse: unknown,
  ) {
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: {
        order: {
          include: { items: { select: { productId: true, quantity: true } } },
        },
      },
    });

    if (!payment) {
      return { settled: false, reason: "unknown-transaction" as const };
    }

    if (payment.status !== PaymentStatus.pending) {
      return { settled: false, reason: "already-settled" as const };
    }

    if (status === PaymentStatus.pending) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { rawResponse: rawResponse as Prisma.InputJsonValue },
      });
      return { settled: false, reason: "still-pending" as const };
    }

    if (status === PaymentStatus.failed) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.failed,
          rawResponse: rawResponse as Prisma.InputJsonValue,
        },
      });
      return { settled: true, status: PaymentStatus.failed };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const shortfall: string[] = [];
        for (const item of payment.order.items) {
          const updated = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count === 0) {
            shortfall.push(item.productId);
          }
        }
        if (shortfall.length > 0) {
          throw new StockShortfallError(shortfall);
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.success,
            rawResponse: rawResponse as Prisma.InputJsonValue,
          },
        });
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.paid },
        });
      });
    } catch (error) {
      if (error instanceof StockShortfallError) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.success,
            rawResponse: {
              providerResponse: rawResponse,
              anomaly: {
                type: "STOCK_SHORTFALL_AFTER_PAYMENT",
                productIds: error.productIds,
                detectedAt: new Date().toISOString(),
              },
            } as Prisma.InputJsonValue,
          },
        });
        console.error(
          "ANOMALY: payment succeeded but stock shortfall — order left pending, manual refund required",
          {
            paymentId: payment.id,
            orderId: payment.orderId,
            productIds: error.productIds,
          }
        );
        return { settled: true, status: PaymentStatus.success, anomaly: true };
      }
      throw error;
    }
    return { settled: true, status: PaymentStatus.success };
  }

  async handleStripeWebhook(meta: CallbackMeta) {
    const strategy = paymentStrategyFactory.get(PaymentProvider.stripe);
    const result = await strategy.handleCallback(meta);
    if (!result) {
      return { received: true };
    }
    await this.settle(result.transactionId, result.status, result.rawResponse);
    return { received: true };
  }

  async handleBkashCallback(query: Record<string, unknown>) {
    const strategy = paymentStrategyFactory.get(PaymentProvider.bkash);

    try {
      const result = await strategy.handleCallback({ query });
      if (!result) {
        return this.bkashRedirect("failed");
      }
      await this.settle(
        result.transactionId,
        result.status,
        result.rawResponse,
      );

      const payment = await prisma.payment.findUnique({
        where: { transactionId: result.transactionId },
        select: { id: true, orderId: true, status: true },
      });
      return this.bkashRedirect(
        payment?.status === PaymentStatus.success ? "success" : "failed",
        payment ?? undefined,
      );
    } catch (error) {
      console.error(
        "bKash callback processing failed",
        { err: error instanceof Error ? error.message : String(error) }
      );
      return this.bkashRedirect("failed");
    }
  }

  async stripeVerify(requester: IRequester, transactionId: string) {
    return this.verifyWithProvider(
      requester,
      transactionId,
      PaymentProvider.stripe,
    );
  }

  async bkashQuery(requester: IRequester, transactionId: string) {
    return this.verifyWithProvider(
      requester,
      transactionId,
      PaymentProvider.bkash,
    );
  }

  async getMyPayments(userId: string, options: IPaginationOptions) {
    const { page, limit, skip, sortBy, sortOrder } =
      paginationHelper.calculatePagination(options);

    const where: Prisma.PaymentWhereInput = { order: { userId } };

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: PAYMENT_INCLUDE,
      }),
      prisma.payment.count({ where }),
    ]);

    return { meta: { page, limit, total }, data };
  }

  async getByIdFromDb(id: string, requester: IRequester) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: PAYMENT_INCLUDE,
    });

    if (
      !payment ||
      (requester.role !== "ADMIN" && payment.order.userId !== requester.id)
    ) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
    }

    return payment;
  }

  async getListFromDb(filters: IPaymentFilters, options: IPaginationOptions) {
    const { page, limit, skip, sortBy, sortOrder } =
      paginationHelper.calculatePagination(options);

    const where: Prisma.PaymentWhereInput = {};
    if (filters.status) {
      where.status = filters.status as PaymentStatus;
    }
    if (filters.provider) {
      where.provider = filters.provider as PaymentProvider;
    }
    if (filters.orderId) {
      where.orderId = filters.orderId;
    }

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: PAYMENT_INCLUDE,
      }),
      prisma.payment.count({ where }),
    ]);

    return { meta: { page, limit, total }, data };
  }

  private async verifyWithProvider(
    requester: IRequester,
    transactionId: string,
    provider: PaymentProvider,
  ) {
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
      include: PAYMENT_INCLUDE,
    });

    if (
      !payment ||
      payment.provider !== provider ||
      (requester.role !== "ADMIN" && payment.order.userId !== requester.id)
    ) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
    }

    const strategy = paymentStrategyFactory.get(provider);
    const result = await strategy.verify(transactionId);
    await this.settle(transactionId, result.status, result.rawResponse);

    return prisma.payment.findUnique({
      where: { id: payment.id },
      include: PAYMENT_INCLUDE,
    });
  }

  private async assertItemsStillAvailable(
    items: Array<{ productId: string; quantity: number }>,
  ) {
    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, isDeleted: false },
      select: { id: true, name: true, stock: true, status: true },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      const product = productsById.get(item.productId);
      if (!product || product.status !== ProductStatus.active) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "An item in this order is no longer available for purchase",
        );
      }
      if (product.stock < item.quantity) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Insufficient stock for ${product.name}: requested ${item.quantity}, available ${product.stock}`,
        );
      }
    }
  }

  private bkashRedirect(
    status: "success" | "failed",
    payment?: { id: string; orderId: string },
  ) {
    const params = new URLSearchParams({ status, provider: "bkash" });
    if (payment) {
      params.set("orderId", payment.orderId);
      params.set("paymentId", payment.id);
    }
    return {
      redirectUrl: `${config.frontendUrl}/payment/result?${params.toString()}`,
    };
  }
}

export const paymentService = new PaymentService();
