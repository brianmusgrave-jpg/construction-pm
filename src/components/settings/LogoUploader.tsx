"use client";

import { useState, useRef } from "react";
import { Upload, Trash2, HardHat, Loader2, AlertCircle } from "lucide-react";
import { uploadLogo, deleteLogo, updateCompanyName } from "@/actions/settings";
import { useTranslations } from "next-intl";

interface LogoUploaderProps {
  logoUrl: string | null;
  companyName: string | null;
}

export function LogoUploader({ logoUrl, companyName }: LogoUploaderProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [currentLogo, setCurrentLogo] = useState(logoUrl);
  const [currentName, setCurrentName] = useState(companyName || "");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (file.size > 2 * 1024 * 1024) {
      setError(t("fileTooLarge"));
      return;
    }

    const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError(t("invalidFormat"));
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("logo", file);
      const result = await uploadLogo(formData);
      setCurrentLogo(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("uploadFailed"));
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete() {
    if (!confirm(t("removeLogoConfirm"))) return;
    setDeleting(true);
    try {
      await deleteLogo();
      setCurrentLogo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToDelete"));
    }
    setDeleting(false);
  }

  function handleNameChange(value: string) {
    setCurrentName(value);
    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
    nameTimeoutRef.current = setTimeout(async () => {
      setSavingName(true);
      try {
        await updateCompanyName(value);
      } catch (e) {
        console.error(e);
      }
      setSavingName(false);
    }, 800);
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        {t("companyBranding")}
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        {t("brandingDescription")}
      </p>

      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <div className="flex items-start gap-6">
        {/* Logo preview & upload */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
            {uploading ? (
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            ) : currentLogo ? (
              <img
                src={currentLogo}
                alt="Logo"
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <HardHat className="w-8 h-8 text-gray-300" />
            )}
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] disabled:opacity-50"
            >
              {currentLogo ? tc("replace") : tc("upload")}
            </button>
            {currentLogo && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {tc("remove")}
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          <p className="text-[10px] text-gray-400 text-center">
            PNG, JPG, SVG, WebP
            <br />
            {t("maxSize")}
          </p>
        </div>

        {/* Company name */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("companyName")}
          </label>
          <div className="relative">
            <input
              type="text"
              value={currentName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t("companyNamePlaceholder")}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
            />
            {savingName && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {tc("saving")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {t("companyNameHelp")}
          </p>
        </div>
      </div>
    </div>
  );
}
