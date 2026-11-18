"use server";

import { revalidatePath } from "next/cache";
import { requireStudentManagementAccess } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  schoolClassIdSchema,
  schoolClassSchema,
  type SchoolClassActionState,
} from "@/lib/validations/class";

function parseClass(formData: FormData) {
  const parsed = schoolClassSchema.safeParse({
    class_name: formData.get("class_name"),
    section: formData.get("section"),
  });
  return parsed.success
    ? parsed.data
    : { error: parsed.error.issues[0]?.message ?? "Enter a valid class and section." };
}

function getClassError(code: string) {
  if (code === "23505") return "This class and section already exist.";
  if (code === "23503") return "This class or section is still assigned to students.";
  return "Unable to save this class and section. Please try again.";
}

function revalidateClassData() {
  for (const path of ["/classes", "/students", "/fee-vouchers", "/payments", "/reports", "/"]) {
    revalidatePath(path);
  }
}

export async function createClass(
  _previousState: SchoolClassActionState,
  formData: FormData,
): Promise<SchoolClassActionState> {
  await requireStudentManagementAccess();
  const input = parseClass(formData);
  if ("error" in input) return input;

  const supabase = await createClient();
  const { error } = await supabase.from("classes").insert(input);
  if (error) {
    console.error("Unable to create the class and section.", error.message);
    return { error: getClassError(error.code) };
  }

  revalidateClassData();
  return { success: "Class and section added." };
}

export async function updateClass(
  classId: string,
  _previousState: SchoolClassActionState,
  formData: FormData,
): Promise<SchoolClassActionState> {
  await requireStudentManagementAccess();
  const parsedId = schoolClassIdSchema.safeParse(classId);
  if (!parsedId.success) return { error: "Invalid class or section." };

  const input = parseClass(formData);
  if ("error" in input) return input;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .update(input)
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to update the class and section.", error.message);
    return { error: getClassError(error.code) };
  }
  if (!data) return { error: "This class or section could not be found." };

  revalidateClassData();
  return { success: "Class and section updated." };
}

export async function deleteClass(
  classId: string,
  _previousState: SchoolClassActionState,
  _formData: FormData,
): Promise<SchoolClassActionState> {
  void _previousState;
  void _formData;
  await requireStudentManagementAccess();
  const parsedId = schoolClassIdSchema.safeParse(classId);
  if (!parsedId.success) return { error: "Invalid class or section." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .delete()
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to delete the class and section.", error.message);
    return {
      error: error.code === "23503"
        ? "Students are assigned to this class and section. Reassign them before deleting it."
        : "Unable to delete this class and section. Please try again.",
    };
  }
  if (!data) return { error: "This class or section could not be found." };

  revalidateClassData();
  return { success: "Class and section deleted." };
}
