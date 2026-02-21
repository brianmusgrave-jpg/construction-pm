import { redirect } from "next/navigation";

// Projects list redirects to dashboard (which shows projects)
export default function ProjectsPage() {
  redirect("/dashboard");
}
