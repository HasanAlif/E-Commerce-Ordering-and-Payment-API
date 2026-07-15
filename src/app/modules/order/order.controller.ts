import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync.js";
import pick from "../../../shared/pick.js";
import sendResponse from "../../../shared/sendResponse.js";
import { orderService } from "./order.service.js";

const orderFilterableFields = ["status", "userId"];

const requesterOf = (req: Request) => ({
  id: req.user.id as string,
  role: req.user.role as string,
});

const createOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await orderService.createIntoDb(req.user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Order created successfully",
    data: result,
  });
});

const getMyOrders = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query as Record<string, unknown>, [
    "page",
    "limit",
    "sortBy",
    "sortOrder",
  ]);
  const result = await orderService.getMyOrders(req.user.id, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Orders retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getOrderById = catchAsync(async (req: Request, res: Response) => {
  const result = await orderService.getByIdFromDb(
    req.params.id as string,
    requesterOf(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order details retrieved successfully",
    data: result,
  });
});

const getAllOrders = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(
    req.query as Record<string, unknown>,
    orderFilterableFields,
  );
  const options = pick(req.query as Record<string, unknown>, [
    "page",
    "limit",
    "sortBy",
    "sortOrder",
  ]);
  const result = await orderService.getListFromDb(filters, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order list retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const cancelOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await orderService.cancelOrder(
    req.params.id as string,
    requesterOf(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order canceled successfully",
    data: result,
  });
});

export const orderController = {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  cancelOrder,
};
