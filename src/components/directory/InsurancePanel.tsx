"use client";

import { useState, useTransition } from "react";
import {
  X,
  Plus,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Loader2,
  Calendar,
  DollarSign,
  FileText,
} from "lucide-react";
import {
  createCertificate,
  updateCertificate,
  deleteCertificate,
  setUmbrellaOverride,
} from "@/actions/insurance";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

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

interface UmbrellaCert extends Certificate {
  staffName: string;
  staffId: string;
}

interface Contact {
  id: string;
  name: string;
  uninsuredOverride: boolean;
  umbrellaPolicyId: string | null;
  umbrellaPolicy: { id: string; carrier: string } | null;
  certificates: Certificate[];
}

interface InsurancePanelProps {
  contact: Contact;
  canManage: boolean;
  allCertificates: UmbrellaCert[];
  onClose: () => void;
}

const COVERAGE_TYPES = [
  "GENERAL_LIABILITY",
  "WORKERS_COMP",
  "AUTO",
  "UMBRELLA",
  "PROFESSIONAL",
  "BUILDERS_RISK",
  "OTHER",
];

export function InsurancePanel({
  contact,
  canManage,
  allCertificates,
  onClose,
}: InsurancePanelProps) {
  const t = useTranslations("insurance");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [umbrellaOverride, setUmbrellaOverrideState] = useState(contact.uninsuredOverride);
  const [selectedUmbrella, setSelectedUmbrella] = useState(contact.umbrellaPolicyId || "");

  // Add form state
  const [carrier, setCarrier] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [coverageType, setCoverageType] = useState("GENERAL_LIABILITY");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [coverageAmount, setCoverageAmount] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setCarrier("");
    setPolicyNumber("");
    setCoverageType("GENERAL_LIABILITY");
    setEffectiveDate("");
    setExpiryDate("");
    setCoverageAmount("");
    setNotes("");
    setShowAddForm(false);
  }

  function handleAdd() {
    if (!carrier.trim() || !effectiveDate || !expiryDate) {
      toast.error(t("requiredFields"));
      return;
    }
    startTransition(async () => {
      try {
        await createCertificate({
          staffId: contact.id,
          carrier: carrier.trim(),
          policyNumber: policyNumber.trim() || undefined,
          coverageType,
          effectiveDate,
          expiryDate,
          coverageAmount: coverageAmount ? parseFloat(coverageAmount) : undefined,
          notes: notes.trim() || undefined,
        });
        toast.success(t("certificateAdded"));
        resetForm();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function handleDelete(certId: string) {
    if (!confirm(t("confirmDelete"))) return;
    startTransition(async () => {
      try {
        await deleteCertificate(certId);
        toast.success(t("certificateDeleted"));
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function handleUmbrellaToggle(checked: boolean) {
    setUmbrellaOverrideState(checked);
    startTransition(async () => {
      try {
        await setUmbrellaOverride({
          staffId: contact.id,
          uninsuredOverride: checked,
          umbrellaPolicyId: checked ? selectedUmbrella || null : null,
        });
        toast.success(t("umbrellaUpdated"));
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function handleUmbrellaSelect(certId: string) {
    setSelectedUmbrella(certId);
    startTransition(async () => {
      try {
        await setUmbrellaOverride({
          staffId: contact.id,
          uninsuredOverride: umbrellaOverride,
          umbrellaPolicyId: certId || null,
        });
        toast.success(t("umbrellaUpdated"));
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function statusBadge(status: string) {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            <ShieldCheck className="w-3 h-3" /> {t("active")}
          </span>
        );
      case "EXPIRING_SOON":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
            <ShieldAlert className="w-3 h-3" /> {t("expiringSoon")}
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            <ShieldX className="w-3 h-3" /> {t("expiredStatus")}
          </span>
        );
      default:
        return (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {status}
          </span>
        );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold text-gray-900">
              {t("insuranceTitle", { name: contact.name })}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Umbrella Override */}
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={umbrellaOverride}
                onChange={(e) => handleUmbrellaToggle(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-blue-900">{t("uninsuredOverride")}</span>
                <p className="text-xs text-blue-600 mt-0.5">{t("uninsuredOverrideDesc")}</p>
              </div>
            </label>
            {umbrellaOverride && allCertificates.length > 0 && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-blue-800 mb-1">
                  {t("selectUmbrellaPolicy")}
                </label>
                <select
                  value={selectedUmbrella}
                  onChange={(e) => handleUmbrellaSelect(e.target.value)}
                  className="w-full p-2 text-sm border border-blue-300 rounded-lg bg-white"
                >
                  <option value="">{t("selectPolicy")}</option>
                  {allCertificates.map((cert) => (
                    <option key={cert.id} value={cert.id}>
                      {cert.staffName} — {cert.carrier} ({cert.policyNumber || "N/A"})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Existing Certificates */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">{t("certificates")}</h3>
              {canManage && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> {t("addCertificate")}
                </button>
              )}
            </div>

            {contact.certificates.length === 0 && !showAddForm && (
              <div className="text-center py-8 text-sm text-gray-400">
                <Shield className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                {t("noCertificates")}
              </div>
            )}

            <div className="space-y-3">
              {contact.certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{cert.carrier}</span>
                        {statusBadge(cert.status)}
                      </div>
                      <span className="text-xs text-gray-500">
                        {t(`type_${cert.coverageType}`)}
                        {cert.policyNumber && ` — #${cert.policyNumber}`}
                      </span>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => handleDelete(cert.id)}
                        disabled={isPending}
                        className="p-1.5 text-gray-300 hover:text-red-500 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(cert.effectiveDate).toLocaleDateString()} — {new Date(cert.expiryDate).toLocaleDateString()}
                    </span>
                    {cert.coverageAmount && (
                      <span className="inline-flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${Number(cert.coverageAmount).toLocaleString()}
                      </span>
                    )}
                    {cert.documentUrl && (
                      <a
                        href={cert.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                      >
                        <FileText className="w-3 h-3" /> {t("viewDoc")}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Certificate Form */}
          {showAddForm && (
            <div className="p-4 border border-dashed border-gray-300 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">{t("newCertificate")}</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("carrier")}</label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder={t("carrierPlaceholder")}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("policyNumber")}</label>
                  <input
                    type="text"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    placeholder={t("policyPlaceholder")}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("coverageTypeLbl")}</label>
                  <select
                    value={coverageType}
                    onChange={(e) => setCoverageType(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    {COVERAGE_TYPES.map((ct) => (
                      <option key={ct} value={ct}>{t(`type_${ct}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("effectiveDate")}</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("expiryDateLbl")}</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("coverageAmountLbl")}</label>
                  <input
                    type="number"
                    value={coverageAmount}
                    onChange={(e) => setCoverageAmount(e.target.value)}
                    placeholder="1000000"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("notesLbl")}</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("notesPlaceholder")}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 border rounded-lg hover:bg-gray-50"
                >
                  {tc("cancel")}
                </button>
                <button
                  onClick={handleAdd}
                  disabled={isPending || !carrier.trim() || !effectiveDate || !expiryDate}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {t("addCertificateBtn")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
