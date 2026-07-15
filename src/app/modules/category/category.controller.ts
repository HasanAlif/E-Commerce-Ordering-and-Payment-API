import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync.js";
import pick from "../../../shared/pick.js";
import sendResponse from "../../../shared/sendResponse.js";
import { categoryService } from "./category.service.js";

const categoryFilterableFields = ["searchTerm", "parentId"];

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await categoryService.createIntoDb(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Category created successfully",
    data: result,
  });
});

const getCategoryList = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query as Record<string, unknown>, categoryFilterableFields);
  const options = pick(req.query as Record<string, unknown>, [
    "page",
    "limit",
    "sortBy",
    "sortOrder",
  ]);
  const result = await categoryService.getListFromDb(filters, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category list retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getCategoryTree = catchAsync(async (req: Request, res: Response) => {
  const result = await categoryService.getTree();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category tree retrieved successfully",
    data: result,
  });
});

const getCategoryById = catchAsync(async (req: Request, res: Response) => {
  const result = await categoryService.getByIdFromDb(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category details retrieved successfully",
    data: result,
  });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await categoryService.updateIntoDb(
    req.params.id as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await categoryService.deleteFromDb(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category deleted successfully",
    data: result,
  });
});

export const categoryController = {
  createCategory,
  getCategoryList,
  getCategoryTree,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
