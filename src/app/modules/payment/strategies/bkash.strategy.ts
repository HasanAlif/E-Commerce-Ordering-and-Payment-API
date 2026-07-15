import httpStatus from "http-status";
import config from "../../../../config/index.js";
import ApiError from "../../../../errors/ApiErrors.js";
import {
  PaymentProvider,
  PaymentStatus,
} from "../../../../generated/prisma/client.js";
import { toMajorUnitsString } from "../../../../shared/money.js";
import { BkashClient } from "./bkash.client.js";
import {
  CallbackMeta,
  CallbackResult,
  InitiateResult,
  OrderForPayment,
  PaymentStrategy,
  VerifyResult,
} from "./payment.strategy.js";

const BKASH_SUCCESS_CODE = "0000";

export class BkashStrategy implements PaymentStrategy {
  readonly provider = PaymentProvider.bkash;

  private client: BkashClient | null;

  constructor(client?: BkashClient) {
    this.client = client ?? null;
  }

  private getClient(): BkashClient {
    if (!this.client) {
      if (!config.bkash.enabled) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "bKash payments are not enabled on this server",
        );
      }
      this.client = new BkashClient();
    }
    return this.client;
  }

  async initiate(order: OrderForPayment): Promise<InitiateResult> {
    const response = await this.getClient().createPayment({
      amount: toMajorUnitsString(order.totalAmount),
      merchantInvoiceNumber: order.id,
      payerReference: order.userId,
    });

    if (response.statusCode !== BKASH_SUCCESS_CODE || !response.paymentID) {
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        `bKash create payment failed: ${response.statusMessage ?? response.statusCode}`,
      );
    }

    return {
      transactionId: response.paymentID,
      rawResponse: response,
      clientPayload: {
        bkashURL: response.bkashURL,
        transactionId: response.paymentID,
      },
    };
  }

  async verify(transactionId: string): Promise<VerifyResult> {
    const response = await this.getClient().queryPayment(transactionId);
    return {
      status: this.mapTransactionStatus(response.transactionStatus),
      rawResponse: response,
    };
  }

  async handleCallback(meta: CallbackMeta): Promise<CallbackResult | null> {
    const paymentID = meta.query?.paymentID;
    const status = meta.query?.status;

    if (typeof paymentID !== "string" || paymentID.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Missing bKash paymentID");
    }

    if (status === "success") {
      const execution = await this.getClient().executePayment(paymentID);
      const settled =
        execution.statusCode === BKASH_SUCCESS_CODE &&
        execution.transactionStatus === "Completed";
      return {
        transactionId: paymentID,
        status: settled ? PaymentStatus.success : PaymentStatus.failed,
        rawResponse: execution,
      };
    }

    return {
      transactionId: paymentID,
      status: PaymentStatus.failed,
      rawResponse: { callbackStatus: status ?? "unknown" },
    };
  }

  private mapTransactionStatus(transactionStatus?: string): PaymentStatus {
    if (transactionStatus === "Completed") return PaymentStatus.success;
    if (transactionStatus === "Initiated") return PaymentStatus.pending;
    return PaymentStatus.failed;
  }
}
