"use server";

import { revalidatePath } from "next/cache";
import { requireStudentManagementAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  studentIdSchema,
  studentSchema,
  studentStatusSchema,
  type StudentActionState,
  type StudentInput,
  type StudentStatus,
} from "@/lib/validations/student";

async function getOrCreateClass(
  supabase: Awaited<ReturnType<typeof createClient>>,
  className: string,
  section: string,
): Promise<{ id: string } | { error: string }> {
  const existing = await supabase
    .from("classes")
    .select("id")
    .eq("class_name", className)
    .eq("section", section)
    .maybeSingle();

  if (existing.error) {
    console.error("Unable to check the selected student class.", existing.error.message);
    return { error: "Unable to verify this class and section. Please try again." };
  }

  if (existing.data) return existing.data;

  const created = await supabase
    .from("classes")
    .insert({ class_name: className, section })
    .select("id")
    .single();

  if (!created.error) return created.data;

  if (created.error.code === "23505") {
    const concurrentClass = await supabase
      .from("classes")
      .select("id")
      .eq("class_name", className)
      .eq("section", section)
      .maybeSingle();

    if (!concurrentClass.error && concurrentClass.data) return concurrentClass.data;
  }

  console.error("Unable to create the requested student class.", created.error.message);
  return { error: "Unable to save this class and section. Please try again." };
}

function parseStudent(formData: FormData) {
  const parsed = studentSchema.safeParse({
    full_name: formData.get("full_name"),
    roll_number: formData.get("roll_number"),
    class_name: formData.get("class_name"),
    section: formData.get("section"),
    monthly_fee_amount: formData.get("monthly_fee_amount"),
    guardian_contact: formData.get("guardian_contact"),
    enrollment_date: formData.get("enrollment_date"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    } satisfies StudentActionState;
  }

  return parsed.data;
}

function getSaveError(message: string, code: string): string {
  if (
    code === "23505" &&
    (message.includes("students_roll_number_key") ||
      message.includes("students_roll_number_normalized_key"))
  ) {
    return "That roll number is already in use. Enter a different roll number.";
  }
  if (code === "23503") {
    return "The selected class or section is no longer available. Please try again.";
  }
  return "Unable to save this student. Please try again.";
}

async function saveStudent(
  input: StudentInput,
  studentId?: string,
): Promise<StudentActionState> {
  const supabase = await createClient();
  const schoolClass = await getOrCreateClass(
    supabase,
    input.class_name,
    input.section,
  );

  if ("error" in schoolClass) return schoolClass;

  const studentData = {
    full_name: input.full_name,
    roll_number: input.roll_number,
    class_id: schoolClass.id,
    section: input.section,
    monthly_fee_amount: input.monthly_fee_amount,
    guardian_contact: input.guardian_contact,
    enrollment_date: input.enrollment_date,
    status: input.status,
  };

  const result = studentId
    ? await supabase
        .from("students")
        .update(studentData)
        .eq("id", studentId)
        .select("id")
        .maybeSingle()
    : await supabase.from("students").insert(studentData).select("id").single();

  if (result.error) {
    console.error("Unable to save the student record.", result.error.message);
    return { error: getSaveError(result.error.message, result.error.code) };
  }

  if (!result.data) {
    return { error: "This student could not be found or is no longer available." };
  }

  revalidatePath("/students");
  revalidatePath(`/students/${result.data.id}`);
  revalidatePath("/");

  return {
    studentId: result.data.id,
    success: studentId ? "Student details updated." : "Student added successfully.",
  };
}

export async function createStudent(
  _previousState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  await requireStudentManagementAccess();
  const input = parseStudent(formData);
  if ("error" in input) return input;
  return saveStudent(input);
}

export async function updateStudent(
  studentId: string,
  _previousState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  await requireStudentManagementAccess();
  const parsedId = studentIdSchema.safeParse(studentId);
  if (!parsedId.success) return { error: "Invalid student record." };

  const input = parseStudent(formData);
  if ("error" in input) return input;
  return saveStudent(input, parsedId.data);
}

export async function changeStudentStatus(
  studentId: string,
  status: StudentStatus,
): Promise<StudentActionState> {
  await requireStudentManagementAccess();

  const parsedId = studentIdSchema.safeParse(studentId);
  const parsedStatus = studentStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    return { error: "Invalid student status request." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .update({ status: parsedStatus.data })
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to update student status.", error.message);
    return { error: "Unable to update this student's status. Please try again." };
  }

  if (!data) return { error: "This student could not be found or is no longer available." };

  revalidatePath("/students");
  revalidatePath(`/students/${parsedId.data}`);
  revalidatePath("/");
  return {
    studentId: parsedId.data,
    success: parsedStatus.data === "inactive" ? "Student deactivated." : "Student reactivated.",
  };
}
