import {
  PaymentProvider,
  PaymentStatus,
} from "../../../../generated/prisma/client.js";

export interface OrderForPayment {
  id: string;
  paymentId: string;
  userId: string;
  totalAmount: number;
  currency: string;
}

export interface InitiateResult {
  transactionId: string;
  rawResponse: unknown;
  clientPayload: Record<string, unknown>;
}

export interface VerifyResult {
  status: PaymentStatus;
  rawResponse: unknown;
}

export interface CallbackMeta {
  rawBody?: Buffer;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
}

export interface CallbackResult {
  transactionId: string;
  status: PaymentStatus;
  rawResponse: unknown;
}

export interface PaymentStrategy {
  readonly provider: PaymentProvider;

  initiate(order: OrderForPayment): Promise<InitiateResult>;

  verify(transactionId: string): Promise<VerifyResult>;

  handleCallback(meta: CallbackMeta): Promise<CallbackResult | null>;
}
