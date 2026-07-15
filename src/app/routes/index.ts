import express from "express";
import { userRoutes } from "../modules/user/user.route.js";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { categoryRoutes } from "../modules/category/category.route.js";
import { productRoutes } from "../modules/product/product.route.js";
import { orderRoutes } from "../modules/order/order.route.js";
import { paymentRoutes } from "../modules/payment/payment.route.js";

const router = express.Router();

const moduleRoutes = [
  { path: "/users", route: userRoutes },
  { path: "/auth", route: authRoutes },
  { path: "/categories", route: categoryRoutes },
  { path: "/products", route: productRoutes },
  { path: "/orders", route: orderRoutes },
  { path: "/payments", route: paymentRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
