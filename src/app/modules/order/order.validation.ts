import { z } from "zod";

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid("productId must be a valid UUID"),
        quantity: z
          .number()
          .int("Quantity must be an integer")
          .min(1, "Quantity must be at least 1"),
      }),
    )
    .min(1, "Order must contain at least one item"),
});

export const orderValidation = {
  createOrderSchema,
};
