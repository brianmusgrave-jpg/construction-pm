/**
 * @file src/app/signup/page.tsx
 * @description Public signup page — new org creation (Sprint 15 + Sprint 17).
 *
 * Flow:
 *   1. User enters company name, email, password
 *   2. Selects a plan (Starter, Pro, Enterprise) or "Start 14-day free trial"
 *   3. For paid plans → redirect to Stripe Checkout
 *   4. For trial → create org + user immediately, redirect to /dashboard
 *
 * The page is public (no auth required — listed in middleware publicPaths).
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HardHat, Check, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Plan cards                                                          */
/* ------------------------------------------------------------------ */

const PLANS = [
  {
    id: "STARTER",
    name: "Starter",
    price: "$29",
    period: "/month",
    features: ["5 team members", "10 projects", "Core PM features", "Gantt charts", "Client portal"],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    id: "PRO",
    name: "Pro",
    price: "$79",
    period: "/month",
    features: ["25 team members", "Unlimited projects", "All Starter features", "AI Voice Transcription", "AI Task Extraction", "QuickBooks Integration", "100k AI tokens/mo"],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: "$249",
    period: "/month",
    features: ["Unlimited team members", "Unlimited projects", "All Pro features", "White Label / Custom Domain", "Priority Support", "500k AI tokens/mo", "Dedicated Account Manager"],
    cta: "Start Free Trial",
    popular: false,
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"info" | "plan">("info");
  const [loading, setLoading] = useState(false);

  // Form fields
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("PRO");

  /* ---------------------------------------------------------------- */
  /*  Step 1 → Step 2                                                  */
  /* ---------------------------------------------------------------- */
  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !email.trim() || !password.trim() || !fullName.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setStep("plan");
  }

  /* ---------------------------------------------------------------- */
  /*  Start free trial                                                 */
  /* ---------------------------------------------------------------- */
  async function handleSignup(plan: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          email: email.trim().toLowerCase(),
          password,
          fullName: fullName.trim(),
          plan,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // If Stripe checkout URL is returned, redirect to Stripe
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      // Otherwise, trial account created — sign in and redirect
      toast.success("Account created! Signing you in...");
      // Auto-sign-in via credentials
      const { signIn } = await import("next-auth/react");
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.ok) {
        router.push("/onboarding");
      } else {
        router.push("/login");
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Step 1: Company + Account Info                                    */
  /* ---------------------------------------------------------------- */
  if (step === "info") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <HardHat className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">Construction PM</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Create your account</h1>
            <p className="text-sm text-gray-500 mb-6">Start your 14-day free trial. No credit card required.</p>

            <form onSubmit={handleContinue} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="John Smith"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Smith Construction LLC"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="john@smithconstruction.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Choose Your Plan
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-gray-500">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Step 2: Plan Selection                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <HardHat className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">Construction PM</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose your plan</h1>
          <p className="text-gray-500">All plans include a 14-day free trial. Cancel anytime.</p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative bg-white rounded-xl border-2 p-6 cursor-pointer transition-all ${
                selectedPlan === plan.id
                  ? "border-blue-600 ring-2 ring-blue-100"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => handleSignup(selectedPlan)}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white py-3 px-8 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Start 14-Day Free Trial
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <button
            onClick={() => setStep("info")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to account info
          </button>
        </div>
      </div>
    </div>
  );
}
