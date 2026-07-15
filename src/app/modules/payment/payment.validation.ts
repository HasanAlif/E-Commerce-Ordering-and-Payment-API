import { z } from "zod";

const initiateSchema = z.object({
  orderId: z.string().uuid("orderId must be a valid UUID"),
  provider: z.enum(["stripe", "bkash"], {
    errorMap: () => ({ message: "Provider must be 'stripe' or 'bkash'" }),
  }),
});

const stripeVerifySchema = z.object({
  transactionId: z.string().min(1, "transactionId is required"),
});

export const paymentValidation = {
  initiateSchema,
  stripeVerifySchema,
};
