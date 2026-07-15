import express from "express";
import auth from "../../middlewares/auth.js";
import optionalAuth from "../../middlewares/optionalAuth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { productController } from "./product.controller.js";
import { productValidation } from "./product.validation.js";

const router = express.Router();

router.get("/", optionalAuth, productController.getProductList);

router.get("/:id/recommendations", productController.getRecommendations);

router.get("/:id", optionalAuth, productController.getProductById);

router.post(
  "/",
  auth("ADMIN"),
  validateRequest(productValidation.createSchema),
  productController.createProduct,
);

router.patch(
  "/:id",
  auth("ADMIN"),
  validateRequest(productValidation.updateSchema),
  productController.updateProduct,
);

router.delete("/:id", auth("ADMIN"), productController.deleteProduct);

export const productRoutes = router;
