"use client";

import { useState, useTransition, useMemo } from "react";
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
  Trash2,
  Download,
  X,
  Loader2,
  CheckSquare,
  Search,
  MapPin,
  Star,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  FileText,
} from "lucide-react";
import { ContactFormModal } from "./ContactFormModal";
import { InsurancePanel } from "./InsurancePanel";
import { bulkDeleteStaff, bulkUpdateStaffType, exportStaffCsv } from "@/actions/staff";
import { updateStaffRating, exportInsuranceCsv } from "@/actions/insurance";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

type ContactType = "TEAM" | "SUBCONTRACTOR" | "VENDOR" | "INSPECTOR";

interface Certificate {
  id: string;
  carrier: string;
  policyNumber: string | null;
  coverageType: string;
  effectiveDate: string;
  expiryDate: string;
  coverageAmount: number | null;
  documentUrl: string | null;
  status: string;
  notes: string | null;
}

interface Contact {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  contactType: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  rating: number | null;
  notes: string | null;
  uninsuredOverride: boolean;
  umbrellaPolicyId: string | null;
  umbrellaPolicy: { id: string; carrier: string } | null;
  assignments: {
    id: string;
    phase: { id: string; name: string; projectId: string };
  }[];
  certificates: Certificate[];
}

interface DirectoryClientProps {
  contacts: Contact[];
  canManage: boolean;
  isPM: boolean;
}

export function DirectoryClient({ contacts, canManage, isPM }: DirectoryClientProps) {
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

  const [insurancePanel, setInsurancePanel] = useState<Contact | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<ContactType | "ALL">("ALL");

  const filtered = useMemo(() => {
    let result = contacts;
    if (filterType !== "ALL") {
      result = result.filter((c) => c.contactType === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.company && c.company.toLowerCase().includes(q)) ||
          (c.role && c.role.toLowerCase().includes(q)) ||
          (c.location && c.location.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return result;
  }, [contacts, searchQuery, filterType]);

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    config: TYPE_CONFIG[type],
    contacts: filtered.filter((c) => c.contactType === type),
  })).filter((g) => g.contacts.length > 0);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  }

  function exitBulkMode() {
    setBulkMode(false);
    setSelected(new Set());
  }

  function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(t("confirmBulkDelete", { count: selected.size }))) return;
    startTransition(async () => {
      try {
        const result = await bulkDeleteStaff(Array.from(selected));
        toast.success(t("bulkDeleted", { count: result.deleted }));
        exitBulkMode();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function handleBulkRetype(newType: string) {
    if (selected.size === 0) return;
    startTransition(async () => {
      try {
        const result = await bulkUpdateStaffType(Array.from(selected), newType);
        toast.success(t("bulkUpdated", { count: result.updated }));
        exitBulkMode();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function handleExport() {
    startTransition(async () => {
      try {
        const csv = await exportStaffCsv();
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "directory.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t("exported"));
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function handleInsuranceExport() {
    startTransition(async () => {
      try {
        const csv = await exportInsuranceCsv();
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "insurance-compliance.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t("insuranceExported"));
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function handleRating(staffId: string, rating: number) {
    startTransition(async () => {
      try {
        await updateStaffRating(staffId, rating);
        toast.success(t("ratingUpdated"));
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function getInsuranceStatus(person: Contact): {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    label: string;
  } {
    if (person.uninsuredOverride) {
      return { icon: Shield, color: "text-blue-500", label: t("coveredByUmbrella") };
    }
    if (person.certificates.length === 0) {
      return { icon: ShieldX, color: "text-red-500", label: t("noCoverage") };
    }
    const hasExpired = person.certificates.some((c) => c.status === "EXPIRED");
    const hasExpiring = person.certificates.some((c) => c.status === "EXPIRING_SOON");
    if (hasExpired) {
      return { icon: ShieldAlert, color: "text-red-500", label: t("expired") };
    }
    if (hasExpiring) {
      return { icon: ShieldAlert, color: "text-yellow-500", label: t("expiringSoon") };
    }
    return { icon: ShieldCheck, color: "text-green-500", label: t("insured") };
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("contactCount", { count: contacts.length, groups: grouped.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && contacts.length > 0 && (
            <>
              <button
                onClick={handleInsuranceExport}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                title={t("exportInsurance")}
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">{t("exportInsurance")}</span>
              </button>
              <button
                onClick={handleExport}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                title={t("exportCsv")}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{t("exportCsv")}</span>
              </button>
              <button
                onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
                  bulkMode ? "bg-gray-100 border-gray-300" : "hover:bg-gray-50"
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span className="hidden sm:inline">{bulkMode ? tc("done") : t("bulkSelect")}</span>
              </button>
            </>
          )}
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
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              filterType === "ALL"
                ? "border-[var(--color-primary)] bg-[var(--color-primary-bg)] text-[var(--color-primary-dark)]"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tc("all")}
          </button>
          {TYPE_ORDER.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                filterType === type
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-bg)] text-[var(--color-primary-dark)]"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {TYPE_CONFIG[type].label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && selected.size > 0 && (
        <div className="sticky top-0 z-10 mb-4 p-3 bg-white border rounded-xl shadow-lg flex items-center gap-3 flex-wrap">
          <button onClick={selectAll} className="text-sm text-[var(--color-primary)] hover:underline">
            {selected.size === filtered.length ? t("deselectAll") : t("selectAll")}
          </button>
          <span className="text-sm text-gray-500">
            {t("selectedCount", { count: selected.size })}
          </span>
          <div className="flex-1" />
          <select
            onChange={(e) => {
              if (e.target.value) handleBulkRetype(e.target.value);
              e.target.value = "";
            }}
            className="px-3 py-1.5 text-sm border rounded-lg bg-white"
            defaultValue=""
          >
            <option value="" disabled>{t("moveTo")}</option>
            {TYPE_ORDER.map((t2) => (
              <option key={t2} value={t2}>{TYPE_CONFIG[t2].label}</option>
            ))}
          </select>
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {tc("delete")}
          </button>
          <button onClick={exitBulkMode} className="p-1.5 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 && contacts.length > 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">{t("noResults")}</h3>
          <p className="text-sm text-gray-500">{t("tryDifferentSearch")}</p>
        </div>
      )}

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
                  {groupContacts.map((person) => {
                    const insurance = getInsuranceStatus(person);
                    const InsIcon = insurance.icon;
                    return (
                      <div
                        key={person.id}
                        onClick={bulkMode ? () => toggleSelect(person.id) : undefined}
                        className={`bg-white rounded-xl border p-5 hover:border-[var(--color-primary-light)] hover:shadow-md transition-all group relative ${
                          bulkMode ? "cursor-pointer" : ""
                        } ${selected.has(person.id) ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary-bg)]" : "border-gray-200"}`}
                      >
                        {bulkMode && (
                          <div className="absolute top-3 left-3">
                            <input
                              type="checkbox"
                              checked={selected.has(person.id)}
                              onChange={() => toggleSelect(person.id)}
                              className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                          </div>
                        )}
                        {canManage && !bulkMode && (
                          <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => setInsurancePanel(person)}
                              className="p-2 text-gray-300 hover:text-[var(--color-primary)] hover:bg-gray-100 rounded-lg"
                              title={t("manageInsurance")}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setModalState({ mode: "edit", contact: person })}
                              className="p-2 text-gray-300 hover:text-[var(--color-primary)] hover:bg-gray-100 rounded-lg"
                              title={t("editContact")}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <div className={`flex items-start gap-3 mb-3 ${bulkMode ? "ml-6" : ""}`}>
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
                          <div className="flex items-center gap-1.5">
                            <span title={insurance.label}>
                              <InsIcon className={`w-4 h-4 ${insurance.color}`} />
                            </span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.badge}`}>
                              {config.label}
                            </span>
                          </div>
                        </div>

                        {/* PM-only rating */}
                        {isPM && (
                          <div className="flex items-center gap-0.5 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRating(person.id, star === person.rating ? 0 : star);
                                }}
                                className="p-0"
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    person.rating && star <= person.rating
                                      ? "text-yellow-400 fill-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1.5 text-sm">
                          {person.company && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate">{person.company}</span>
                            </div>
                          )}
                          {person.location && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate">{person.location}</span>
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
                    );
                  })}
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

      {insurancePanel && (
        <InsurancePanel
          contact={insurancePanel}
          canManage={canManage}
          allCertificates={contacts.flatMap((c) =>
            c.certificates.filter((cert) => cert.coverageType === "UMBRELLA").map((cert) => ({
              ...cert,
              staffName: c.name,
              staffId: c.id,
            }))
          )}
          onClose={() => setInsurancePanel(null)}
        />
      )}
    </div>
  );
}
