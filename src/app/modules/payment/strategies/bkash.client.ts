import axios, { AxiosInstance } from "axios";
import httpStatus from "http-status";
import config from "../../../../config/index.js";
import ApiError from "../../../../errors/ApiErrors.js";
import { redisGet, redisSet } from "../../../lib/redis.js";

const TOKEN_CACHE_KEY = "bkash:token";
const TOKEN_TTL_SECONDS = 55 * 60;

export interface BkashCreateResponse {
  statusCode: string;
  statusMessage?: string;
  paymentID: string;
  bkashURL: string;
  [key: string]: unknown;
}

export interface BkashExecuteResponse {
  statusCode: string;
  statusMessage?: string;
  paymentID?: string;
  trxID?: string;
  transactionStatus?: string;
  [key: string]: unknown;
}

export interface BkashQueryResponse {
  statusCode: string;
  statusMessage?: string;
  paymentID?: string;
  trxID?: string;
  transactionStatus?: string;
  [key: string]: unknown;
}

export class BkashClient {
  private http: AxiosInstance;
  private memoryToken: { token: string; expiresAt: number } | null = null;

  constructor(http?: AxiosInstance) {
    this.http =
      http ??
      axios.create({
        baseURL: config.bkash.base_url,
        timeout: 30_000,
        headers: { Accept: "application/json" },
      });
  }

  private async getToken(): Promise<string> {
    if (this.memoryToken && this.memoryToken.expiresAt > Date.now()) {
      return this.memoryToken.token;
    }

    const cached = await redisGet(TOKEN_CACHE_KEY);
    if (cached) {
      this.memoryToken = { token: cached, expiresAt: Date.now() + 60_000 };
      return cached;
    }

    const { data } = await this.http.post(
      "/tokenized/checkout/token/grant",
      { app_key: config.bkash.app_key, app_secret: config.bkash.app_secret },
      {
        headers: {
          username: config.bkash.username as string,
          password: config.bkash.password as string,
        },
      },
    );

    const token = data?.id_token as string | undefined;
    if (!token) {
      console.error(
        "bKash token grant failed",
        { statusCode: data?.statusCode }
      );
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        `bKash token grant failed: ${data?.statusMessage ?? "no id_token returned"}`,
      );
    }

    this.memoryToken = {
      token,
      expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
    };
    await redisSet(TOKEN_CACHE_KEY, token, TOKEN_TTL_SECONDS);
    return token;
  }

  private async authorizedHeaders() {
    return {
      Authorization: await this.getToken(),
      "X-APP-Key": config.bkash.app_key as string,
    };
  }

  async createPayment(params: {
    amount: string;
    merchantInvoiceNumber: string;
    payerReference: string;
  }): Promise<BkashCreateResponse> {
    const { data } = await this.http.post(
      "/tokenized/checkout/create",
      {
        mode: "0011",
        payerReference: params.payerReference,
        callbackURL: config.bkash.callback_url,
        amount: params.amount,
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: params.merchantInvoiceNumber,
      },
      { headers: await this.authorizedHeaders() },
    );
    return data as BkashCreateResponse;
  }

  async executePayment(paymentID: string): Promise<BkashExecuteResponse> {
    const { data } = await this.http.post(
      "/tokenized/checkout/execute",
      { paymentID },
      { headers: await this.authorizedHeaders() },
    );
    return data as BkashExecuteResponse;
  }

  async queryPayment(paymentID: string): Promise<BkashQueryResponse> {
    const { data } = await this.http.post(
      "/tokenized/checkout/payment/status",
      { paymentID },
      { headers: await this.authorizedHeaders() },
    );
    return data as BkashQueryResponse;
  }
}
