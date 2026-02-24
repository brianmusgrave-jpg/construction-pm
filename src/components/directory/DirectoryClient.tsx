"use client";

import { useState } from "react";
import {
  Users,
  Mail,
  Phone,
  Building2,
  HardHat,
  Truck,
  ClipboardCheck,
  Plus,
  Pencil,
} from "lucide-react";
import { ContactFormModal } from "./ContactFormModal";
import { useTranslations } from "next-intl";

type ContactType = "TEAM" | "SUBCONTRACTOR" | "VENDOR" | "INSPECTOR";

interface Contact {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  contactType: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  assignments: {
    id: string;
    phase: { id: string; name: string; projectId: string };
  }[];
}

interface DirectoryClientProps {
  contacts: Contact[];
  canManage: boolean;
}

export function DirectoryClient({ contacts, canManage }: DirectoryClientProps) {
  const t = useTranslations("directory");
  const tc = useTranslations("common");

  const TYPE_CONFIG: Record<ContactType, {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    badge: string;
  }> = {
    TEAM: {
      label: t("teamLabel"),
      description: t("teamDesc"),
      icon: HardHat,
      color: "bg-blue-50 text-blue-700 border-blue-200",
      badge: "bg-blue-100 text-blue-700",
    },
    SUBCONTRACTOR: {
      label: t("subcontractorLabel"),
      description: t("subcontractorDesc"),
      icon: Users,
      color: "bg-orange-50 text-orange-700 border-orange-200",
      badge: "bg-orange-100 text-orange-700",
    },
    VENDOR: {
      label: t("vendorLabel"),
      description: t("vendorDesc"),
      icon: Truck,
      color: "bg-green-50 text-green-700 border-green-200",
      badge: "bg-green-100 text-green-700",
    },
    INSPECTOR: {
      label: t("inspectorLabel"),
      description: t("inspectorDesc"),
      icon: ClipboardCheck,
      color: "bg-purple-50 text-purple-700 border-purple-200",
      badge: "bg-purple-100 text-purple-700",
    },
  };

  const TYPE_ORDER: ContactType[] = ["TEAM", "SUBCONTRACTOR", "INSPECTOR", "VENDOR"];

  const [modalState, setModalState] = useState<
    | { mode: "add"; contact?: undefined }
    | { mode: "edit"; contact: Contact }
    | null
  >(null);

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    config: TYPE_CONFIG[type],
    contacts: contacts.filter((c) => c.contactType === type),
  })).filter((g) => g.contacts.length > 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("contactCount", { count: contacts.length, groups: grouped.length })}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setModalState({ mode: "add" })}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("addContact")}
          </button>
        )}
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">{t("noContactsYet")}</h3>
          <p className="text-sm text-gray-500 mb-4">{t("noContactsMessage")}</p>
          {canManage && (
            <button
              onClick={() => setModalState({ mode: "add" })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("addFirstContact")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ type, config, contacts: groupContacts }) => {
            const Icon = config.icon;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5 text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-900">{config.label}</h2>
                  <span className="text-xs text-gray-400">{groupContacts.length}</span>
                </div>
                <p className="text-sm text-gray-500 mb-3 -mt-1">{config.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupContacts.map((person) => (
                    <div
                      key={person.id}
                      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[var(--color-primary-light)] hover:shadow-md transition-all group relative"
                    >
                      {canManage && (
                        <button
                          onClick={() => setModalState({ mode: "edit", contact: person })}
                          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-[var(--color-primary)] rounded transition-colors"
                          title={t("editContact")}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center text-[var(--color-primary-dark)] font-medium text-sm shrink-0">
                          {person.name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {person.name}
                          </h3>
                          {person.role && (
                            <p className="text-sm text-gray-500">{person.role}</p>
                          )}
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.badge}`}>
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
                            {t("assignedTo")}
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

      {modalState && (
        <ContactFormModal
          mode={modalState.mode}
          contact={modalState.contact}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
