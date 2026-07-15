import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync.js";
import pick from "../../../shared/pick.js";
import sendResponse from "../../../shared/sendResponse.js";
import { paymentService } from "./payment.service.js";

const paymentFilterableFields = ["status", "provider", "orderId"];

const requesterOf = (req: Request) => ({
  id: req.user.id as string,
  role: req.user.role as string,
});

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.initiate(requesterOf(req), req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Payment initiated successfully",
    data: result,
  });
});

const stripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.handleStripeWebhook({
    rawBody: req.body as Buffer,
    headers: req.headers,
  });
  res.status(httpStatus.OK).json(result);
});

const stripeVerify = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.stripeVerify(
    requesterOf(req),
    req.body.transactionId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment status synced with Stripe",
    data: result,
  });
});

const bkashCallback = catchAsync(async (req: Request, res: Response) => {
  const { redirectUrl } = await paymentService.handleBkashCallback(
    req.query as Record<string, unknown>,
  );
  res.redirect(redirectUrl);
});

const bkashQuery = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.bkashQuery(
    requesterOf(req),
    req.params.transactionId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment status synced with bKash",
    data: result,
  });
});

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query as Record<string, unknown>, [
    "page",
    "limit",
    "sortBy",
    "sortOrder",
  ]);
  const result = await paymentService.getMyPayments(req.user.id, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.getByIdFromDb(
    req.params.id as string,
    requesterOf(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment details retrieved successfully",
    data: result,
  });
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(
    req.query as Record<string, unknown>,
    paymentFilterableFields,
  );
  const options = pick(req.query as Record<string, unknown>, [
    "page",
    "limit",
    "sortBy",
    "sortOrder",
  ]);
  const result = await paymentService.getListFromDb(filters, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment list retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const paymentController = {
  initiatePayment,
  stripeWebhook,
  stripeVerify,
  bkashCallback,
  bkashQuery,
  getMyPayments,
  getPaymentById,
  getAllPayments,
};
