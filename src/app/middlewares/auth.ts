import { NextFunction, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import httpStatus from "http-status";
import config from "../../config/index.js";
import ApiError from "../../errors/ApiErrors.js";
import { jwtHelpers } from "../../helpers/jwtHelpers.js";
import { prisma } from "../lib/prisma.js";

const extractToken = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  if (req.cookies?.token) {
    return req.cookies.token;
  }

  if (req.headers["x-auth-token"]) {
    return req.headers["x-auth-token"] as string;
  }

  return undefined;
};

const auth = (...roles: string[]) => {
  return async (
    req: Request & { user?: JwtPayload },
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const token = extractToken(req);

      if (!token) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required");
      }

      const decoded = jwtHelpers.verifyToken(
        token,
        config.jwt.jwt_secret as string,
      );

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          status: true,
          role: true,
          isDeleted: true,
        },
      });

      if (!user || user.isDeleted) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "User not found");
      }

      if (user.status === "BLOCKED") {
        throw new ApiError(httpStatus.FORBIDDEN, "Your account is blocked");
      }

      if (user.status === "SUSPEND") {
        throw new ApiError(httpStatus.FORBIDDEN, "Your account is suspended");
      }

      if (roles.length && !roles.includes(user.role)) {
        throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
      }

      req.user = { id: user.id, email: user.email, role: user.role };
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default auth;
