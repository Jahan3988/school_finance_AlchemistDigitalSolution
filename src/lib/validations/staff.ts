export const managedStaffRoles = [
  "admin",
  "accountant",
  "teacher",
  "receptionist",
] as const;

export type ManagedStaffRole = (typeof managedStaffRoles)[number];

export const themeModes = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof themeModes)[number];
