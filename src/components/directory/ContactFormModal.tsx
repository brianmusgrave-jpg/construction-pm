"use client";

/**
 * @file components/directory/ContactFormModal.tsx
 * @description Add / edit modal for directory contacts.
 *
 * Mode:
 *   - "add"  → calls `createStaff` on submit; no delete button shown.
 *   - "edit" → calls `updateStaff` on submit; shows a "Delete" button that
 *     calls `deleteStaff(contact.id)` after a `confirm()` prompt.
 *
 * Contact type selector: 2×2 button grid for TEAM / SUBCONTRACTOR / VENDOR /
 *   INSPECTOR; defaults to SUBCONTRACTOR for new contacts.
 *
 * Required field: name (non-empty). All other fields (company, role, email,
 *   phone, location, notes) are optional — empty strings are sent as `undefined`.
 *
 * Error handling: inline red banner for validation or server errors.
 *
 * Server actions: `createStaff`, `updateStaff`, `deleteStaff`.
 * i18n namespaces: `directory`, `common`.
 */

import { useState } from "react";
import { X } from "lucide-react";
import { createStaff, updateStaff, deleteStaff } from "@/actions/staff";
import { cn } from "@/lib/utils";
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
  location: string | null;
  notes: string | null;
}

interface ContactFormModalProps {
  mode: "add" | "edit";
  contact?: Contact;
  onClose: () => void;
}

export function ContactFormModal({ mode, contact, onClose }: ContactFormModalProps) {
  const t = useTranslations("directory");
  const tc = useTranslations("common");

  const CONTACT_TYPES: { value: ContactType; label: string }[] = [
    { value: "TEAM", label: t("teamMember") },
    { value: "SUBCONTRACTOR", label: t("subcontractor") },
    { value: "VENDOR", label: t("vendorSupplier") },
    { value: "INSPECTOR", label: t("inspector") },
  ];

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(contact?.name ?? "");
  const [company, setCompany] = useState(contact?.company ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [contactType, setContactType] = useState<ContactType>(
    (contact?.contactType as ContactType) ?? "SUBCONTRACTOR"
  );
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [location, setLocation] = useState(contact?.location ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }

    setError(null);
    setSaving(true);

    try {
      if (mode === "add") {
        await createStaff({
          name: name.trim(),
          company: company.trim() || undefined,
          role: role.trim() || undefined,
          contactType,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else if (contact) {
        await updateStaff({
          id: contact.id,
          name: name.trim(),
          company: company.trim() || undefined,
          role: role.trim() || undefined,
          contactType,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("somethingWentWrong"));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!contact) return;
    if (!confirm(t("deleteConfirm", { name: contact.name }))) return;

    setDeleting(true);
    try {
      await deleteStaff(contact.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToDelete"));
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === "add" ? t("addContactModal") : t("editContactModal")}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t("type")}</label>
            <div className="grid grid-cols-2 gap-2">
              {CONTACT_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setContactType(ct.value)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-lg border transition-colors text-center",
                    contactType === ct.value
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-bg)] text-[var(--color-primary-dark)]"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("nameField")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("company")}</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t("companyPlaceholder")}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("roleTrade")}</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={t("rolePlaceholder")}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("phone")}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phonePlaceholder")}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("location")}</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("locationPlaceholder")}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("notes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t("notesPlaceholder")}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {mode === "edit" && contact && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  {deleting ? t("deleting") : t("deleteContact")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {tc("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
              >
                {saving
                  ? tc("saving")
                  : mode === "add"
                    ? t("addContactBtn")
                    : t("saveChanges")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
