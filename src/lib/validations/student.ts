import { z } from "zod";

const moneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Enter an amount with up to 2 decimal places.")
  .transform(Number)
  .pipe(
    z
      .number()
      .finite()
      .min(0, "Monthly fee cannot be negative.")
      .max(9_999_999_999.99, "Monthly fee exceeds the supported limit."),
  );

export const studentSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Enter the student's full name.")
    .max(160, "Name must be 160 characters or fewer."),
  roll_number: z
    .string()
    .trim()
    .min(1, "Enter a roll number.")
    .max(40, "Roll number must be 40 characters or fewer."),
  class_name: z
    .string()
    .trim()
    .min(1, "Enter a class.")
    .max(80, "Class must be 80 characters or fewer."),
  section: z
    .string()
    .trim()
    .min(1, "Enter a section.")
    .max(40, "Section must be 40 characters or fewer."),
  monthly_fee_amount: moneySchema,
  guardian_contact: z
    .string()
    .trim()
    .min(1, "Enter a guardian contact.")
    .max(80, "Guardian contact must be 80 characters or fewer."),
  enrollment_date: z.iso.date("Enter a valid enrollment date."),
  status: z.enum(["active", "inactive"], {
    error: "Select a valid student status.",
  }),
});

export const studentIdSchema = z.uuid("Invalid student record.");
export const studentStatusSchema = z.enum(["active", "inactive"]);

export type StudentInput = z.infer<typeof studentSchema>;
export type StudentStatus = z.infer<typeof studentStatusSchema>;
export type StudentField = keyof StudentInput;
export type StudentActionState = {
  error?: string;
  success?: string;
  studentId?: string;
  fieldErrors?: Partial<Record<StudentField, string[]>>;
};
