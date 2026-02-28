"use client";

import { useState } from "react";
import { updatePhaseStatus } from "@/actions/phases";
import { Eye, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface ContractorPhaseActionsProps {
  phaseId: string;
  status: string;
}

export function ContractorPhaseActions({
  phaseId,
  status,
}: ContractorPhaseActionsProps) {
  const t = useTranslations("contractor");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRequestReview() {
    setLoading(true);
    try {
      await updatePhaseStatus(phaseId, "REVIEW_REQUESTED");
      setDone(true);
    } catch (e) {
      console.error("Failed to request review:", e);
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-4 py-2.5 rounded-lg">
        <Eye className="w-4 h-4" />
        {t("reviewRequested")}
      </div>
    );
  }

  if (status !== "IN_PROGRESS") return null;

  return (
    <button
      onClick={handleRequestReview}
      disabled={loading}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("requesting")}
        </>
      ) : (
        <>
          <Eye className="w-4 h-4" />
          {t("requestReview")}
        </>
      )}
    </button>
  );
}
