import { z } from "zod";

const CreateUserValidationSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100),
  email: z.string().email("Please provide a valid email"),
  mobileNumber: z.string().min(10, "Mobile number must be at least 10 digits"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const UserLoginValidationSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  password: z.string().min(1, "Password is required"),
});

const UpdateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  mobileNumber: z.string().min(10).optional(),
});

const VerifyRegistrationOtpSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const ResendRegistrationOtpSchema = z.object({
  email: z.string().email("Please provide a valid email"),
});

export const UserValidation = {
  CreateUserValidationSchema,
  UserLoginValidationSchema,
  UpdateProfileSchema,
  VerifyRegistrationOtpSchema,
  ResendRegistrationOtpSchema,
};
