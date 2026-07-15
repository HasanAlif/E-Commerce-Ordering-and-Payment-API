import * as bcrypt from "bcryptjs";
import crypto from "crypto";
import httpStatus from "http-status";
import config from "../../../config/index.js";
import ApiError from "../../../errors/ApiErrors.js";
import { jwtHelpers } from "../../../helpers/jwtHelpers.js";
import emailSender from "../../../shared/emailSender.js";
import { EMAIL_VERIFICATION_TEMPLATE } from "../../../utils/Template.js";
import { prisma } from "../../lib/prisma.js";

const logOtpWhenMailSkipped = (sent: boolean, email: string, otp: string) => {
  if (!sent && config.env !== "production") {
    console.debug(
      "Mail not configured — OTP logged for dev use only",
      { email, otp }
    );
  }
};

const createUserIntoDb = async (payload: {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
}) => {
  const email = payload.email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser && existingUser.isVerified) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "User with this email already exists",
    );
  }

  const existingMobile = await prisma.user.findFirst({
    where: {
      mobileNumber: payload.mobileNumber,
      isVerified: true,
    },
  });

  if (existingMobile) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "User with this mobile number already exists",
    );
  }

  const hashedPassword = await bcrypt.hash(
    payload.password,
    config.bcrypt_salt_rounds,
  );

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

  if (existingUser && !existingUser.isVerified) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        fullName: payload.fullName,
        mobileNumber: payload.mobileNumber,
        password: hashedPassword,
        verificationOtp: otp,
        verificationOtpExpiry: otpExpiry,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        fullName: payload.fullName,
        email,
        mobileNumber: payload.mobileNumber,
        password: hashedPassword,
        isVerified: false,
        verificationOtp: otp,
        verificationOtpExpiry: otpExpiry,
      },
    });
  }

  const { sent } = await emailSender(
    email,
    EMAIL_VERIFICATION_TEMPLATE(otp),
    `Email Verification OTP - ${config.site_name || "E-Commerce"}`,
  );
  logOtpWhenMailSkipped(sent, email, otp);

  return {
    message: "OTP sent to your email. Please verify to complete registration.",
    email,
  };
};

const verifyRegistrationOtp = async (payload: {
  email: string;
  otp: string;
}) => {
  const email = payload.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobileNumber: true,
      role: true,
      isVerified: true,
      verificationOtp: true,
      verificationOtpExpiry: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email is already verified");
  }

  if (
    !user.verificationOtp ||
    !user.verificationOtpExpiry ||
    user.verificationOtp !== payload.otp ||
    user.verificationOtpExpiry < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationOtp: null,
      verificationOtpExpiry: null,
    },
  });

  const token = jwtHelpers.generateToken(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string,
  );

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
  };
};

const resendRegistrationOtp = async (email: string) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email is already verified");
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationOtp: otp,
      verificationOtpExpiry: otpExpiry,
    },
  });

  const { sent } = await emailSender(
    normalizedEmail,
    EMAIL_VERIFICATION_TEMPLATE(otp),
    `Email Verification OTP - ${config.site_name || "E-Commerce"}`,
  );
  logOtpWhenMailSkipped(sent, normalizedEmail, otp);

  return {
    message: "OTP resent to your email",
    email: normalizedEmail,
  };
};

export const userService = {
  createUserIntoDb,
  verifyRegistrationOtp,
  resendRegistrationOtp,
};
