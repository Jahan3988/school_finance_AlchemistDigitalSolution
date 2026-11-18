import { z } from "zod";

export const schoolClassSchema = z.object({
  class_name: z
    .string()
    .trim()
    .min(1, "Enter a class name.")
    .max(80, "Class name must be 80 characters or fewer."),
  section: z
    .string()
    .trim()
    .min(1, "Enter a section.")
    .max(40, "Section must be 40 characters or fewer."),
});

export const schoolClassIdSchema = z.uuid("Invalid class or section.");

export type SchoolClassInput = z.infer<typeof schoolClassSchema>;
export type SchoolClassActionState = {
  error?: string;
  success?: string;
};
