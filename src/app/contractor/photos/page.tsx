import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Camera } from "lucide-react";

export default async function ContractorPhotos() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const memberships = await db.projectMember.findMany({
    where: { userId: session.user.id },
    select: { project: { select: { id: true, name: true } } },
  });

  const projectIds = memberships.map((m) => m.project.id);

  const photos = await db.photo.findMany({
    where: {
      phase: { projectId: { in: projectIds } },
    },
    include: {
      phase: {
        select: { name: true, project: { select: { name: true } } },
      },
      uploadedBy: { select: { name: true } },
    },
    orderBy: { takenAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Site Photos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Photo documentation across your assigned projects
        </p>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Camera className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No photos yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Site photos will appear here once uploaded to your project phases
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <a
              key={photo.id}
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 hover:border-orange-300"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption || "Site photo"}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-white text-xs font-medium truncate">
                  {photo.phase.project.name} · {photo.phase.name}
                </p>
                {photo.caption && (
                  <p className="text-white/70 text-xs truncate mt-0.5">
                    {photo.caption}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
