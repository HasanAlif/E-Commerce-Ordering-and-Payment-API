import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import handleZodError from "../../errors/handleZodError.js";
import handlePrismaError from "../../errors/handlePrismaError.js";
import ApiError from "../../errors/ApiErrors.js";

interface ErrorSource {
  type?: string;
  field?: string;
  path?: string | number;
  message?: string;
  details?: string;
}

const nodeEnv = process.env.NODE_ENV || "development";

const GlobalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message: string;
  let errorSources: ErrorSource[];

  if (err instanceof ZodError) {
    const simplifiedError = handleZodError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorSources = simplifiedError.errorSources;
  } else if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errorSources = [{ type: "ApiError", details: err.message }];
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(err);
    statusCode = prismaError.statusCode;
    message = prismaError.message;
    errorSources = prismaError.errorSources;
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Invalid data provided";
    errorSources = [
      { type: "ValidationError", message: "Please check your input data" },
    ];
  } else if (err instanceof SyntaxError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Syntax error in the request. Please verify your input.";
    errorSources = [{ type: "SyntaxError", message: err.message }];
  } else if (err instanceof TypeError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Type error in the application. Please verify your input.";
    errorSources = [{ type: "TypeError", message: err.message }];
  } else {
    message = "An unexpected error occurred!";
    const errMessage = err instanceof Error ? err.message : String(err);
    errorSources = [{ type: "UnknownError", message: errMessage }];
  }

  console.error(message, {
    err,
    method: req.method,
    path: req.originalUrl,
    statusCode,
  });

  const stack = err instanceof Error ? err.stack : undefined;

  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    stack: nodeEnv === "development" ? stack : undefined,
  });
};

export default GlobalErrorHandler;
