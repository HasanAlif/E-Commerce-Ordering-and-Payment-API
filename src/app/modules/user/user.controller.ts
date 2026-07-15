import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync.js";
import sendResponse from "../../../shared/sendResponse.js";
import { userService } from "./user.service.js";

const createUser = catchAsync(async (req: Request, res: Response) => {
  const { fullName, email, mobileNumber, password } = req.body;
  const result = await userService.createUserIntoDb({
    fullName,
    email,
    mobileNumber,
    password,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent to your email. Please verify to complete registration.",
    data: result,
  });
});

const verifyRegistrationOtp = catchAsync(
  async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const result = await userService.verifyRegistrationOtp({ email, otp });

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Email verified and registration completed successfully!",
      data: result,
    });
  },
);

const resendRegistrationOtp = catchAsync(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await userService.resendRegistrationOtp(email);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "OTP resent to your email",
      data: result,
    });
  },
);

export const userController = {
  createUser,
  verifyRegistrationOtp,
  resendRegistrationOtp,
};
