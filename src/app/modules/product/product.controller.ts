import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync.js";
import pick from "../../../shared/pick.js";
import sendResponse from "../../../shared/sendResponse.js";
import { productService } from "./product.service.js";

const productFilterableFields = [
  "searchTerm",
  "categoryId",
  "status",
  "minPrice",
  "maxPrice",
];

const isAdminRequest = (req: Request): boolean => req.user?.role === "ADMIN";

const createProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await productService.createIntoDb(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Product created successfully",
    data: result,
  });
});

const getProductList = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(
    req.query as Record<string, unknown>,
    productFilterableFields,
  );
  const options = pick(req.query as Record<string, unknown>, [
    "page",
    "limit",
    "sortBy",
    "sortOrder",
  ]);
  const result = await productService.getListFromDb(
    filters,
    options,
    isAdminRequest(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product list retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getProductById = catchAsync(async (req: Request, res: Response) => {
  const result = await productService.getByIdFromDb(
    req.params.id as string,
    isAdminRequest(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product details retrieved successfully",
    data: result,
  });
});

const getRecommendations = catchAsync(async (req: Request, res: Response) => {
  const result = await productService.getRecommendations(
    req.params.id as string,
    req.query.limit as string | undefined,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Recommended products retrieved successfully",
    data: result,
  });
});

const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await productService.updateIntoDb(
    req.params.id as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await productService.deleteFromDb(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product deleted successfully",
    data: result,
  });
});

export const productController = {
  createProduct,
  getProductList,
  getProductById,
  getRecommendations,
  updateProduct,
  deleteProduct,
};
