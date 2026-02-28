"use client";

/**
 * @file ProfileEditor.tsx
 * @description User profile editor displaying name, phone, and company fields in a
 * two-column grid alongside an avatar image (or User icon fallback) and a read-only
 * email. Calls updateProfile() on save and shows a "saved" or "noChanges" toast based
 * on whether any values actually changed. Server action: updateProfile. i18n: profile.
 */

import { useState, useTransition } from "react";
import { User, Loader2, Save } from "lucide-react";
import { updateProfile } from "@/actions/profile";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface Props {
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    company: string | null;
    image: string | null;
  };
}

export function ProfileEditor({ user }: Props) {
  const t = useTranslations("profile");
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [company, setCompany] = useState(user.company ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        const result = await updateProfile({ name, phone, company });
        if (result.changed) {
          toast.success(t("saved"));
        } else {
          toast.info(t("noChanges"));
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
          {user.image ? (
            <img src={user.image} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-gray-500" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{t("title")}</h3>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("name")}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("phone")}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("company")}</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
          />
        </div>
      </div>

      <p className="text-xs text-gray-400">{t("changesLogged")}</p>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t("save")}
        </button>
      </div>
    </div>
  );
}
