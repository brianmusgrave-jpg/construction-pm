"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { setLocale } from "@/i18n/locale";
import type { Locale } from "@/i18n/request";

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇲🇽" },
];

interface Props {
  currentLocale: string;
}

export function LanguagePicker({ currentLocale }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(locale: Locale) {
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Globe className="w-5 h-5 text-gray-400" />
      <div className="flex gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              currentLocale === lang.code
                ? "border-[var(--color-primary)] bg-[var(--color-primary-bg)] text-[var(--color-primary-dark)]"
                : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            } ${isPending ? "opacity-50" : ""}`}
          >
            <span>{lang.flag}</span>
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
