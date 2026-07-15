import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(255),
  slug: z
    .string()
    .regex(slugPattern, "Slug must be kebab-case (lowercase letters, digits, hyphens)")
    .max(255)
    .optional(),
  description: z.string().optional(),
  parentId: z.string().uuid("parentId must be a valid UUID").nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(255).optional(),
  slug: z
    .string()
    .regex(slugPattern, "Slug must be kebab-case (lowercase letters, digits, hyphens)")
    .max(255)
    .optional(),
  description: z.string().nullable().optional(),
  parentId: z.string().uuid("parentId must be a valid UUID").nullable().optional(),
});

export const categoryValidation = {
  createSchema,
  updateSchema,
};
