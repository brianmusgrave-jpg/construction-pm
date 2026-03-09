/**
 * @file src/app/(auth)/privacy/page.tsx
 * @description Public Privacy Policy page — accessible without login.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            Back
          </Link>
        </div>
        <p className="text-sm text-gray-500">{t("effectiveDate")}</p>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
          <h2>{t("section1Title")}</h2>
          <p>{t("section1Body")}</p>
          <h2>{t("section2Title")}</h2>
          <p>{t("section2Body")}</p>
          <h2>{t("section3Title")}</h2>
          <p>{t("section3Body")}</p>
          <h2>{t("section4Title")}</h2>
          <p>{t("section4Body")}</p>
          <h2>{t("section5Title")}</h2>
          <p>{t("section5Body")}</p>
          <h2>{t("section6Title")}</h2>
          <p>{t("section6Body")}</p>
        </div>

        <div className="text-sm text-gray-400 pt-4 border-t">
          <p>{t("contactLine")}</p>
        </div>
      </div>
    </div>
  );
}
