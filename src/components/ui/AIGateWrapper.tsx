"use client";

/**
 * @file src/components/ui/AIGateWrapper.tsx
 * @description Wraps AI feature buttons with plan-based gating (Sprint 16).
 *
 * If the org is on STARTER plan, shows a lock icon with tooltip.
 * If AI budget > 90%, shows a warning badge.
 * Otherwise, renders children normally.
 */

import { Lock, AlertTriangle } from "lucide-react";

interface AIGateWrapperProps {
  /** Current org plan from session */
  orgPlan?: string;
  /** Current token usage ratio (0.0 – 1.0) — optional */
  usageRatio?: number;
  /** Content to render when AI is allowed */
  children: React.ReactNode;
  /** Optional label for the locked tooltip */
  featureName?: string;
}

export function AIGateWrapper({
  orgPlan,
  usageRatio,
  children,
  featureName = "This feature",
}: AIGateWrapperProps) {
  // Plan gating: STARTER orgs can't use AI
  if (orgPlan === "STARTER") {
    return (
      <div className="relative group inline-flex">
        <div className="opacity-50 pointer-events-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg">
            <Lock className="w-3 h-3" />
            <span>Pro required</span>
          </div>
        </div>
        {/* Hover tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          {featureName} requires a Pro or Enterprise plan
        </div>
      </div>
    );
  }

  // Budget warning: >90% usage
  if (usageRatio !== undefined && usageRatio > 0.9 && usageRatio < 1) {
    return (
      <div className="relative">
        {children}
        <div className="absolute -top-1 -right-1 z-10">
          <div className="group relative">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <div className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-amber-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {Math.round(usageRatio * 100)}% of AI budget used
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Budget exceeded
  if (usageRatio !== undefined && usageRatio >= 1) {
    return (
      <div className="relative group inline-flex">
        <div className="opacity-50 pointer-events-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-1 px-2 py-1 bg-red-700 text-white text-xs rounded shadow-lg">
            <AlertTriangle className="w-3 h-3" />
            <span>Budget exceeded</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
