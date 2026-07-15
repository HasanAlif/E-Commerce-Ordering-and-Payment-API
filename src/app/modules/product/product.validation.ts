import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(255),
  sku: z
    .string()
    .min(1, "SKU cannot be empty")
    .max(100)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "SKU may contain letters, digits, hyphens and underscores",
    ),
  description: z.string().optional(),
  price: z.number().int("Price must be integer minor units").nonnegative(),
  stock: z.number().int().nonnegative().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  categoryId: z.string().uuid("categoryId must be a valid UUID"),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sku: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "SKU may contain letters, digits, hyphens and underscores",
    )
    .optional(),
  description: z.string().nullable().optional(),
  price: z
    .number()
    .int("Price must be integer minor units")
    .nonnegative()
    .optional(),
  stock: z.number().int().nonnegative().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  categoryId: z.string().uuid().optional(),
});

export const productValidation = {
  createSchema,
  updateSchema,
};
