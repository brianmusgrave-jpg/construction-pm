"use client";

/**
 * @file PaymentAppAIPanel.tsx
 * @description AI-powered payment application intelligence panel — Sprint 32.
 * Provides payment validation and schedule forecasting.
 * Teal-themed to complement the payment application section.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  Calculator,
  TrendingUp,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { validatePaymentApplication, forecastPaymentSchedule } from "@/actions/ai-payment-app";

interface PaymentAppAIPanelProps {
  projectId: string;
  phaseId: string;
  applications: any[];
}

export default function PaymentAppAIPanel({
  projectId,
  phaseId,
  applications,
}: PaymentAppAIPanelProps) {
  const t = useTranslations("paymentAppAI");

  const [selectedAppId, setSelectedAppId] = useState("");
  const [validation, setValidation] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  const [forecast, setForecast] = useState<any>(null);
  const [forecasting, setForecasting] = useState(false);

  const handleValidate = async () => {
    if (!selectedAppId) return;
    setValidating(true);
    setValidation(null);
    try {
      const result = await validatePaymentApplication(selectedAppId, projectId);
      if (result.success && result.validation) {
        setValidation(result.validation);
        toast.success(t("validated"));
      } else {
        toast.error(result.error || t("validateFailed"));
      }
    } catch {
      toast.error(t("validateFailed"));
    } finally {
      setValidating(false);
    }
  };

  const handleForecast = async () => {
    setForecasting(true);
    setForecast(null);
    try {
      const result = await forecastPaymentSchedule(phaseId, projectId);
      if (result.success && result.forecast) {
        setForecast(result.forecast);
        toast.success(t("forecasted"));
      } else {
        toast.error(result.error || t("forecastFailed"));
      }
    } catch {
      toast.error(t("forecastFailed"));
    } finally {
      setForecasting(false);
    }
  };

  const issueSeverityBadge = (s: string) => {
    switch (s) {
      case "ERROR": return "bg-red-100 text-red-700";
      case "WARNING": return "bg-yellow-100 text-yellow-700";
      case "INFO": return "bg-blue-100 text-blue-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const overbillingBadge = (level: string) => {
    switch (level) {
      case "NONE": return "bg-green-100 text-green-700";
      case "LOW": return "bg-blue-100 text-blue-700";
      case "MODERATE": return "bg-yellow-100 text-yellow-700";
      case "HIGH": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="border border-teal-200 rounded-lg bg-teal-50/50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-teal-600" />
        <h3 className="font-semibold text-teal-900">{t("title")}</h3>
      </div>

      {/* Payment Application Validator */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Calculator className="w-4 h-4 text-teal-500" />
          {t("validator")}
        </div>

        {applications.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{t("noApplications")}</p>
        ) : (
          <>
            <div className="flex gap-2">
              <select
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">{t("selectApplication")}</option>
                {applications.map((app: any) => (
                  <option key={app.id} value={app.id}>
                    #{app.number} — ${(app.currentDue || 0).toLocaleString()} ({app.status})
                  </option>
                ))}
              </select>
              <button
                onClick={handleValidate}
                disabled={validating || !selectedAppId}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                {validating ? t("validating") : t("validate")}
              </button>
            </div>
          </>
        )}

        {validation && (
          <div className="border border-teal-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${validation.validationScore >= 7 ? "text-green-600" : validation.validationScore >= 4 ? "text-yellow-600" : "text-red-600"}`}>
                  {validation.validationScore}/10
                </span>
                {validation.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded ${overbillingBadge(validation.overbillingRisk)}`}>
                {t("overbillingRisk")}: {validation.overbillingRisk}
              </span>
            </div>

            {validation.mathCheck && (
              <div className="text-xs bg-gray-50 rounded p-2 space-y-1">
                <div className="font-medium text-gray-600">{t("mathCheck")}</div>
                <div className="flex justify-between">
                  <span>{t("calculated")}: ${validation.mathCheck.currentDueCalculated?.toLocaleString()}</span>
                  <span>{t("submitted")}: ${validation.mathCheck.currentDueSubmitted?.toLocaleString()}</span>
                  <span className={validation.mathCheck.mathCorrect ? "text-green-600" : "text-red-600"}>
                    {validation.mathCheck.mathCorrect ? "✓ Correct" : `✗ Δ $${validation.mathCheck.variance?.toLocaleString()}`}
                  </span>
                </div>
              </div>
            )}

            {validation.summary && (
              <p className="text-sm text-gray-600">{validation.summary}</p>
            )}

            {validation.issues?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t("issues")}
                </div>
                {validation.issues.map((issue: any, i: number) => (
                  <div key={i} className="text-xs pl-4 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className={`px-1 py-0 rounded ${issueSeverityBadge(issue.severity)}`}>{issue.severity}</span>
                      <span className="text-gray-500">{issue.category}</span>
                    </div>
                    <div className="text-gray-600 pl-2">{issue.issue}</div>
                    <div className="text-teal-600 pl-2">→ {issue.recommendation}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Schedule Forecast */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <TrendingUp className="w-4 h-4 text-teal-500" />
          {t("scheduleForecast")}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleForecast}
            disabled={forecasting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {forecasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            {forecasting ? t("forecasting") : t("forecast")}
          </button>
        </div>

        {forecast && (
          <div className="border border-teal-200 rounded-md p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-teal-50 rounded p-2">
                <div className="text-lg font-bold text-teal-700">${forecast.projectedRemaining?.toLocaleString() || 0}</div>
                <div className="text-xs text-gray-500">{t("remaining")}</div>
              </div>
              <div className="bg-teal-50 rounded p-2">
                <div className="text-lg font-bold text-teal-700">{forecast.estimatedApplicationsLeft || 0}</div>
                <div className="text-xs text-gray-500">{t("appsLeft")}</div>
              </div>
              <div className="bg-teal-50 rounded p-2">
                <div className="text-lg font-bold text-teal-700">${forecast.monthlyBurnRate?.toLocaleString() || 0}</div>
                <div className="text-xs text-gray-500">{t("monthlyRate")}</div>
              </div>
            </div>

            {forecast.summary && (
              <p className="text-sm text-gray-600">{forecast.summary}</p>
            )}

            {forecast.forecast?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-teal-600">{t("upcomingPayments")}</div>
                {forecast.forecast.map((f: any, i: number) => (
                  <div key={i} className="text-xs flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                    <span className="font-medium text-gray-700">#{f.applicationNumber}</span>
                    <span className="text-gray-500">{f.estimatedDate}</span>
                    <span className="font-bold text-teal-700">${f.projectedAmount?.toLocaleString()}</span>
                    <span className="text-gray-400 text-[10px]">{f.milestone}</span>
                  </div>
                ))}
              </div>
            )}

            {forecast.cashFlowRisks?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t("cashFlowRisks")}
                </div>
                {forecast.cashFlowRisks.map((r: string, i: number) => (
                  <div key={i} className="text-xs text-amber-600 pl-4">• {r}</div>
                ))}
              </div>
            )}

            {forecast.recommendations?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {t("recommendations")}
                </div>
                {forecast.recommendations.map((r: string, i: number) => (
                  <div key={i} className="text-xs text-green-600 pl-4">• {r}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
