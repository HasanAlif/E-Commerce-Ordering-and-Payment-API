import express from "express";
import auth from "../../middlewares/auth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { paymentController } from "./payment.controller.js";
import { paymentValidation } from "./payment.validation.js";

const router = express.Router();

router.post(
  "/initiate",
  auth(),
  validateRequest(paymentValidation.initiateSchema),
  paymentController.initiatePayment,
);

router.post("/stripe/webhook", paymentController.stripeWebhook);

router.post(
  "/stripe/verify",
  auth(),
  validateRequest(paymentValidation.stripeVerifySchema),
  paymentController.stripeVerify,
);

router.get("/bkash/callback", paymentController.bkashCallback);

router.post(
  "/bkash/query/:transactionId",
  auth(),
  paymentController.bkashQuery,
);

router.get("/my", auth(), paymentController.getMyPayments);

router.get("/", auth("ADMIN"), paymentController.getAllPayments);

router.get("/:id", auth(), paymentController.getPaymentById);

export const paymentRoutes = router;
