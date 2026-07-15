import express from "express";
import auth from "../../middlewares/auth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { categoryController } from "./category.controller.js";
import { categoryValidation } from "./category.validation.js";

const router = express.Router();

router.get("/", categoryController.getCategoryList);

router.get("/tree", categoryController.getCategoryTree);

router.get("/:id", categoryController.getCategoryById);

router.post(
  "/",
  auth("ADMIN"),
  validateRequest(categoryValidation.createSchema),
  categoryController.createCategory,
);

router.patch(
  "/:id",
  auth("ADMIN"),
  validateRequest(categoryValidation.updateSchema),
  categoryController.updateCategory,
);

router.delete("/:id", auth("ADMIN"), categoryController.deleteCategory);

export const categoryRoutes = router;
