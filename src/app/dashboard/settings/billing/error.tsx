"use client";

/**
 * @file src/app/dashboard/settings/billing/error.tsx
 * @description Error boundary for the billing page. Shows a friendly fallback
 * when Stripe isn't configured or the Organization/Subscription tables are empty.
 */

import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isConfigError =
    error.message?.includes("Stripe") ||
    error.message?.includes("STRIPE") ||
    error.message?.includes("subscription") ||
    error.message?.includes("organization") ||
    error.message?.includes("Cannot read properties");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Billing & Subscription
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your plan, view usage, and update payment details.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-amber-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mb-4">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {isConfigError
            ? "Billing Not Configured"
            : "Unable to Load Billing"}
        </h2>

        <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
          {isConfigError
            ? "Stripe API keys haven't been set up yet. To enable billing features, add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to your Vercel environment variables."
            : "Something went wrong while loading billing information. This may be a temporary issue."}
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>

        {error.digest && (
          <p className="text-xs text-gray-400 mt-4">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
