/**
 * @file src/app/dashboard/staff/page.tsx
 * @description Legacy staff route. Immediately redirects to /dashboard/directory.
 */
import { redirect } from "next/navigation";

export default function StaffPage() {
  redirect("/dashboard/directory");
}
