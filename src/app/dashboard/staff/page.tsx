import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Users, Mail, Phone, Building2, Briefcase } from "lucide-react";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const staff = await db.staff.findMany({
    include: {
      assignments: {
        include: {
          phase: {
            select: { id: true, name: true, projectId: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            {staff.length} team member{staff.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {staff.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No staff members yet
          </h3>
          <p className="text-sm text-gray-500">
            Staff members will appear here once added to projects.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((person) => (
            <div
              key={person.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm shrink-0">
                  {person.name[0]}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {person.name}
                  </h3>
                  {person.role && (
                    <p className="text-sm text-gray-500">{person.role}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                {person.company && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    {person.company}
                  </div>
                )}
                {person.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    {person.email}
                  </div>
                )}
                {person.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    {person.phone}
                  </div>
                )}
              </div>

              {person.assignments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">
                    Assigned to
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {person.assignments.map((a) => (
                      <span
                        key={a.id}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                      >
                        {a.phase.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
