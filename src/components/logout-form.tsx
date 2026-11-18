"use client";

import type { MouseEvent } from "react";
import { logout } from "@/app/(dashboard)/actions";

export function LogoutForm({ className }: { className?: string }) {
  function confirmLogout(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm("Sign out of your school finance account?")) {
      event.preventDefault();
    }
  }

  return (
    <form action={logout}>
      <button type="submit" onClick={confirmLogout} className={className}>
        Logout
      </button>
    </form>
  );
}
