"use client";

/**
 * @file components/settings/TotpSection.tsx
 * @description Settings panel for managing TOTP two-factor authentication.
 *
 * Renders a three-state wizard:
 *   1. **Idle / not enabled** — "Enable 2FA" button; calls `setupTotp` which
 *      returns a QR code data-URL and the base32 secret.
 *   2. **Setup** — displays the QR code (and the manual entry key formatted in
 *      groups of 4 for readability), then a 6-digit numeric input that calls
 *      `verifyAndEnableTotp`. Input is stripped of non-digits on change.
 *   3. **Enabled & verified** — shows a confirmation state with a "Disable 2FA"
 *      button (requires user confirm dialog) that calls `disableTotp`.
 *
 * The component is fully self-contained: it derives the current step from
 * local `enabled`/`verified`/`step` state seeded from props.
 *
 * Server actions: `setupTotp`, `verifyAndEnableTotp`, `disableTotp` (totp).
 */

import { useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  Key,
} from "lucide-react";
import { setupTotp, verifyAndEnableTotp, disableTotp } from "@/actions/totp";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

interface TotpSectionProps {
  enabled: boolean;
  verified: boolean;
}

export function TotpSection({ enabled: initEnabled, verified: initVerified }: TotpSectionProps) {
  const confirm = useConfirmDialog();
  const [enabled, setEnabled] = useState(initEnabled);
  const [verified, setVerified] = useState(initVerified);
  const [step, setStep] = useState<"idle" | "setup" | "verify" | "disabling">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const handleSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await setupTotp();
      setQrDataUrl(res.qrCodeDataUrl);
      setSecret(res.secret);
      setStep("setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set up 2FA");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const res = await verifyAndEnableTotp(code);
      if (res.success) {
        setEnabled(true);
        setVerified(true);
        setStep("idle");
        setCode("");
        setQrDataUrl(null);
        setSecret(null);
      } else {
        setError(res.error ?? "Verification failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!await confirm("Disable two-factor authentication? Your account will be less secure.", { danger: true })) return;
    setLoading(true);
    setError(null);
    try {
      await disableTotp();
      setEnabled(false);
      setVerified(false);
      setStep("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable 2FA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <Shield className="w-4 h-4 text-[var(--color-primary)]" />
          Two-Factor Authentication
          {enabled && verified && (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full normal-case flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Enabled
            </span>
          )}
        </h2>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {!enabled && step === "idle" && (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Add an extra layer of security to your account using a TOTP authenticator app (Google Authenticator, Authy, 1Password, etc.).
          </p>
          <button
            onClick={handleSetup}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-lg disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Enable Two-Factor Authentication
          </button>
        </div>
      )}

      {step === "setup" && qrDataUrl && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-800 mb-1">Step 1: Scan this QR code</p>
            <p className="text-xs text-gray-500 mb-3">Open your authenticator app and scan the code below.</p>
            <div className="inline-block p-3 bg-white border-2 border-gray-200 rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="2FA QR Code" className="w-40 h-40" />
            </div>
          </div>
          {secret && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Or enter this key manually:</p>
              <code className="block text-xs bg-gray-50 border border-gray-200 rounded px-3 py-2 font-mono tracking-widest select-all">
                {secret.match(/.{1,4}/g)?.join(" ")}
              </code>
            </div>
          )}
          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-800 mb-1">Step 2: Enter the 6-digit code</p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-40 border border-gray-200 rounded-md px-3 py-2 text-sm text-center font-mono tracking-widest focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep("idle"); setCode(""); setQrDataUrl(null); setSecret(null); }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-md disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                Verify & Enable
              </button>
            </div>
          </form>
        </div>
      )}

      {enabled && verified && step === "idle" && (
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-gray-800 font-medium">Two-factor authentication is active</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Your account is protected with TOTP. You will be asked for a code on each sign-in.
            </p>
            <button
              onClick={handleDisable}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
              Disable 2FA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
