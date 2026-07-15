import express from "express";
import auth from "../../middlewares/auth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { orderController } from "./order.controller.js";
import { orderValidation } from "./order.validation.js";

const router = express.Router();

router.post(
  "/",
  auth(),
  validateRequest(orderValidation.createOrderSchema),
  orderController.createOrder,
);

router.get("/my", auth(), orderController.getMyOrders);

router.get("/", auth("ADMIN"), orderController.getAllOrders);

router.get("/:id", auth(), orderController.getOrderById);

router.patch("/:id/cancel", auth(), orderController.cancelOrder);

export const orderRoutes = router;
