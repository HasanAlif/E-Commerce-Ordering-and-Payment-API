import express from "express";
import validateRequest from "../../middlewares/validateRequest.js";
import { userController } from "./user.controller.js";
import { UserValidation } from "./user.validation.js";

const router = express.Router();

router.post(
  "/register",
  validateRequest(UserValidation.CreateUserValidationSchema),
  userController.createUser,
);

router.post(
  "/verify-registration",
  validateRequest(UserValidation.VerifyRegistrationOtpSchema),
  userController.verifyRegistrationOtp,
);

router.post(
  "/resend-registration-otp",
  validateRequest(UserValidation.ResendRegistrationOtpSchema),
  userController.resendRegistrationOtp,
);

export const userRoutes = router;
