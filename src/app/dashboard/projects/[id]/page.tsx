import { redirect } from "next/navigation";

// Project overview redirects to timeline view
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/projects/${id}/timeline`);
}
