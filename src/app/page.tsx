/**
 * @file src/app/page.tsx
 * @description Public landing page. Displays the HardHat brand icon, app tagline,
 * and a "Go to Dashboard" CTA link. Uses home/common i18n namespaces.
 */
import Link from "next/link";
import { HardHat, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-lg">
        <HardHat className="w-16 h-16 text-blue-600 mx-auto mb-6" />
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          {tc("appName")}
        </h1>
        <p className="text-lg text-gray-500 mb-8">
          {t("tagline")}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg text-base font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          {t("goToDashboard")}
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
