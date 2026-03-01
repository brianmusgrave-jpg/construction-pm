"use client";

/**
 * @file src/app/onboarding/page.tsx
 * @description 5-step onboarding wizard for new accounts (Sprint 17).
 *
 * Steps:
 *   1. Company Info — name, logo placeholder, address
 *   2. First Project — project name, address, start date
 *   3. Invite Team — up to 3 emails + roles
 *   4. Quick Tour — feature highlights
 *   5. All Done — success screen with dashboard link
 *
 * Each step saves data via server actions, then advances.
 * Users can skip steps 2-4 but must complete step 1.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FolderKanban,
  Users,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  Loader2,
} from "lucide-react";

const STEPS = [
  { icon: Building2, title: "Company Info", desc: "Tell us about your business" },
  { icon: FolderKanban, title: "First Project", desc: "Set up your first project" },
  { icon: Users, title: "Invite Team", desc: "Bring your crew on board" },
  { icon: Lightbulb, title: "Quick Tour", desc: "See what you can do" },
  { icon: CheckCircle2, title: "All Done!", desc: "You're ready to build" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1 state
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");

  // Step 2 state
  const [projectName, setProjectName] = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [projectStart, setProjectStart] = useState("");

  // Step 3 state
  const [invites, setInvites] = useState([
    { email: "", role: "PROJECT_MANAGER" },
    { email: "", role: "CONTRACTOR" },
    { email: "", role: "STAKEHOLDER" },
  ]);

  const canNext = () => {
    if (step === 0) return companyName.trim().length > 0;
    return true;
  };

  const handleNext = async () => {
    if (step === 0 && companyName.trim()) {
      setLoading(true);
      try {
        await fetch("/api/onboarding/company", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: companyName.trim(),
            address: companyAddress.trim(),
            phone: companyPhone.trim(),
          }),
        });
      } catch { /* best effort */ }
      setLoading(false);
    }

    if (step === 1 && projectName.trim()) {
      setLoading(true);
      try {
        await fetch("/api/onboarding/project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName.trim(),
            address: projectAddress.trim(),
            startDate: projectStart || null,
          }),
        });
      } catch { /* best effort */ }
      setLoading(false);
    }

    if (step === 2) {
      const validInvites = invites.filter((i) => i.email.includes("@"));
      if (validInvites.length > 0) {
        setLoading(true);
        try {
          await fetch("/api/onboarding/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invites: validInvites }),
          });
        } catch { /* best effort */ }
        setLoading(false);
      }
    }

    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const goToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  i <= step ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Step icon + title */}
        <div className="text-center mb-6">
          {(() => {
            const Icon = STEPS[step].icon;
            return (
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-3">
                <Icon className={`w-7 h-7 ${step === STEPS.length - 1 ? "text-green-600" : "text-blue-600"}`} />
              </div>
            );
          })()}
          <h1 className="text-2xl font-bold text-gray-900">{STEPS[step].title}</h1>
          <p className="text-sm text-gray-500 mt-1">{STEPS[step].desc}</p>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {/* Step 1: Company Info */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Construction Inc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="123 Main St, Charleston, SC 29401"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="(843) 555-0123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: First Project */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Downtown Office Renovation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Address</label>
                <input
                  type="text"
                  value={projectAddress}
                  onChange={(e) => setProjectAddress(e.target.value)}
                  placeholder="456 King St, Charleston, SC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={projectStart}
                  onChange={(e) => setProjectStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Step 3: Invite Team */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-2">
                Invite up to 3 team members. You can add more later.
              </p>
              {invites.map((inv, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="email"
                    value={inv.email}
                    onChange={(e) => {
                      const updated = [...invites];
                      updated[i] = { ...inv, email: e.target.value };
                      setInvites(updated);
                    }}
                    placeholder={`team${i + 1}@company.com`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <select
                    value={inv.role}
                    onChange={(e) => {
                      const updated = [...invites];
                      updated[i] = { ...inv, role: e.target.value };
                      setInvites(updated);
                    }}
                    className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="PROJECT_MANAGER">PM</option>
                    <option value="CONTRACTOR">Contractor</option>
                    <option value="STAKEHOLDER">Stakeholder</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Step 4: Quick Tour */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <FolderKanban className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Project & Phase Management</p>
                  <p className="text-xs text-gray-600">Track every project through customizable phases with photos, documents, and daily logs.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                <Lightbulb className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">AI-Powered Features</p>
                  <p className="text-xs text-gray-600">Voice transcription, smart task extraction, and document analysis powered by AI (Pro plans).</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <Users className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Team Collaboration</p>
                  <p className="text-xs text-gray-600">Invite your crew, assign roles, and give contractors their own portal with limited access.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: All Done */}
          {step === 4 && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re all set!</h2>
              <p className="text-sm text-gray-600 mb-6">
                Your account is ready. Head to the dashboard to start managing your projects.
              </p>
              <button
                onClick={goToDashboard}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        {step < 4 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => step > 0 && setStep(step - 1)}
              disabled={step === 0}
              className="inline-flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-2">
              {step > 0 && step < 4 && (
                <button
                  onClick={() => setStep(step + 1)}
                  className="inline-flex items-center gap-1 px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!canNext() || loading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {step === 3 ? "Finish" : "Continue"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
