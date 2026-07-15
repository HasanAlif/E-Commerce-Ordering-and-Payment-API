import express from "express";
import auth from "../../middlewares/auth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { UserValidation } from "../user/user.validation.js";
import { AuthController } from "./auth.controller.js";
import { authValidation } from "./auth.validation.js";

const router = express.Router();

router.post(
  "/login",
  validateRequest(UserValidation.UserLoginValidationSchema),
  AuthController.loginUser,
);

router.post("/logout", AuthController.logoutUser);

router.get("/me", auth(), AuthController.getMyProfile);

router.put(
  "/change-password",
  auth(),
  validateRequest(authValidation.changePasswordValidationSchema),
  AuthController.changePassword,
);

router.post(
  "/forgot-password",
  validateRequest(authValidation.forgotPasswordSchema),
  AuthController.forgotPassword,
);

router.post(
  "/resend-otp",
  validateRequest(authValidation.resendOtpSchema),
  AuthController.resendOtp,
);

router.post(
  "/verify-otp",
  validateRequest(authValidation.verifyOtpSchema),
  AuthController.verifyForgotPasswordOtp,
);

router.post(
  "/reset-password",
  validateRequest(authValidation.resetPasswordValidationSchema),
  AuthController.resetPassword,
);

router.get("/google", AuthController.getGoogleAuthUrl);

router.get("/google/callback", AuthController.googleCallback);

export const authRoutes = router;
