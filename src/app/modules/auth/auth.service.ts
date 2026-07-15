import * as bcrypt from "bcryptjs";
import crypto from "crypto";
import httpStatus from "http-status";
import { OAuth2Client } from "google-auth-library";
import config from "../../../config/index.js";
import ApiError from "../../../errors/ApiErrors.js";
import { jwtHelpers } from "../../../helpers/jwtHelpers.js";
import emailSender from "../../../shared/emailSender.js";
import { PASSWORD_RESET_TEMPLATE } from "../../../utils/Template.js";
import { prisma } from "../../lib/prisma.js";
import { AuthProvider } from "../../../generated/prisma/client.js";

const googleClient = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.callbackUrl,
);

const SAFE_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  mobileNumber: true,
  profilePicture: true,
  role: true,
  status: true,
  authProvider: true,
  createdAt: true,
  updatedAt: true,
} as const;

const loginUser = async (payload: { email: string; password: string }) => {
  const email = payload.email.toLowerCase().trim();

  const userData = await prisma.user.findUnique({
    where: { email },
  });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "Invalid email or password");
  }

  if (userData.status !== "ACTIVE") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account is inactive or blocked",
    );
  }

  if (!userData.isVerified) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Please verify your email before logging in",
    );
  }

  if (!userData.password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This account uses Google sign-in. Please continue with Google.",
    );
  }

  const isPasswordValid = await bcrypt.compare(
    payload.password,
    userData.password,
  );

  if (!isPasswordValid) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  const accessToken = jwtHelpers.generateToken(
    { id: userData.id, email: userData.email, role: userData.role },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string,
  );

  const user = await prisma.user.findUnique({
    where: { id: userData.id },
    select: SAFE_USER_SELECT,
  });

  return { token: accessToken, user };
};

const getMyProfile = async (userId: string) => {
  const userProfile = await prisma.user.findUnique({
    where: { id: userId },
    select: SAFE_USER_SELECT,
  });

  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return userProfile;
};

const changePassword = async (
  userId: string,
  newPassword: string,
  oldPassword: string,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot change password for Google sign-in accounts. Please set a password first.",
    );
  }

  const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Current password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    config.bcrypt_salt_rounds,
  );

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { message: "Password changed successfully" };
};

const forgotPassword = async (payload: { email: string }) => {
  const email = payload.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "No account found with this email",
    );
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordOtp: otp,
      resetPasswordOtpExpiry: otpExpiry,
    },
  });

  await emailSender(
    email,
    PASSWORD_RESET_TEMPLATE(otp),
    `Password Reset OTP - ${config.site_name || "E-Commerce"}`,
  );

  return { message: "OTP sent to your email" };
};

const resendOtp = async (email: string) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "No account found with this email",
    );
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordOtp: otp,
      resetPasswordOtpExpiry: otpExpiry,
    },
  });

  await emailSender(
    normalizedEmail,
    PASSWORD_RESET_TEMPLATE(otp),
    `Password Reset OTP - ${config.site_name || "E-Commerce"}`,
  );

  return { message: "OTP resent to your email" };
};

const verifyForgotPasswordOtp = async (payload: {
  email: string;
  otp: string;
}) => {
  const email = payload.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      resetPasswordOtp: true,
      resetPasswordOtpExpiry: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (
    !user.resetPasswordOtp ||
    !user.resetPasswordOtpExpiry ||
    user.resetPasswordOtp !== payload.otp ||
    user.resetPasswordOtpExpiry < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordOtpExpiry: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return { message: "OTP verified successfully", isValid: true };
};

const resetPassword = async (
  email: string,
  newPassword: string,
  confirmPassword: string,
  otp: string,
) => {
  if (newPassword !== confirmPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Passwords do not match");
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      resetPasswordOtp: true,
      resetPasswordOtpExpiry: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (
    !user.resetPasswordOtp ||
    !user.resetPasswordOtpExpiry ||
    user.resetPasswordOtp !== otp ||
    user.resetPasswordOtpExpiry < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    config.bcrypt_salt_rounds,
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetPasswordOtp: null,
      resetPasswordOtpExpiry: null,
    },
  });

  return { message: "Password reset successfully" };
};

const getGoogleAuthUrl = () => {
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  const authUrl = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  return { authUrl };
};

const googleCallback = async (code: string) => {
  const { tokens } = await googleClient.getToken(code);

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token as string,
    audience: config.google.clientId,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Failed to get user info from Google",
    );
  }

  const { sub: googleId, email, name, picture } = payload;

  let user = await prisma.user.findFirst({
    where: { googleId },
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          authProvider: AuthProvider.GOOGLE,
          profilePicture: user.profilePicture || picture,
          isVerified: true,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          fullName: name || "Google User",
          email: email!,
          googleId,
          profilePicture: picture,
          authProvider: AuthProvider.GOOGLE,
          isVerified: true,
        },
      });
    }
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account is inactive or blocked",
    );
  }

  const accessToken = jwtHelpers.generateToken(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string,
  );

  const safeUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: SAFE_USER_SELECT,
  });

  return { token: accessToken, user: safeUser };
};

export const authService = {
  loginUser,
  getMyProfile,
  changePassword,
  forgotPassword,
  resendOtp,
  verifyForgotPasswordOtp,
  resetPassword,
  getGoogleAuthUrl,
  googleCallback,
};
