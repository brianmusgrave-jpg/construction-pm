import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Users, Mail, Phone, Building2, HardHat, Truck, ClipboardCheck } from "lucide-react";

const TYPE_CONFIG = {
  TEAM: {
    label: "Team",
    description: "Your employees and core team",
    icon: HardHat,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
  },
  SUBCONTRACTOR: {
    label: "Subcontractors",
    description: "Trades and specialty contractors",
    icon: Users,
    color: "bg-orange-50 text-orange-700 border-orange-200",
    badge: "bg-orange-100 text-orange-700",
  },
  VENDOR: {
    label: "Vendors",
    description: "Suppliers and material providers",
    icon: Truck,
    color: "bg-green-50 text-green-700 border-green-200",
    badge: "bg-green-100 text-green-700",
  },
  INSPECTOR: {
    label: "Inspectors",
    description: "City inspectors, engineers, and consultants",
    icon: ClipboardCheck,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    badge: "bg-purple-100 text-purple-700",
  },
} as const;

const TYPE_ORDER: (keyof typeof TYPE_CONFIG)[] = [
  "TEAM",
  "SUBCONTRACTOR",
  "INSPECTOR",
  "VENDOR",
];

export default async function DirectoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const contacts = await db.staff.findMany({
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

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    config: TYPE_CONFIG[type],
    contacts: contacts.filter((c) => c.contactType === type),
  })).filter((g) => g.contacts.length > 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Directory</h1>
          <p className="text-sm text-gray-500 mt-1">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} across{" "}
            {grouped.length} categories
          </p>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No contacts yet
          </h3>
          <p className="text-sm text-gray-500">
            Add team members, subcontractors, vendors, and inspectors to your
            directory.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ type, config, contacts: groupContacts }) => {
            const Icon = config.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5 text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    {config.label}
                  </h2>
                  <span className="text-xs text-gray-400">
                    {groupContacts.length}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3 -mt-1">
                  {config.description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupContacts.map((person) => (
                    <div
                      key={person.id}
                      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm shrink-0">
                          {person.name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {person.name}
                          </h3>
                          {person.role && (
                            <p className="text-sm text-gray-500">
                              {person.role}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.badge}`}
                        >
                          {config.label}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-sm">
                        {person.company && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="truncate">{person.company}</span>
                          </div>
                        )}
                        {person.email && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="truncate">{person.email}</span>
                          </div>
                        )}
                        {person.phone && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
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
                                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
