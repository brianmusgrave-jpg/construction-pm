/**
 * @file src/app/dashboard/settings/billing/page.tsx
 * @description Billing settings page (Sprint 14). Shows current plan, AI usage,
 * add-on features, payment method stub, invoice history, and ownership transfer.
 * Accessible to org owner and ADMIN users only.
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getBillingInfo, getInvoiceHistory, getOrgAdminUsers } from "@/actions/billing";
import { BillingClient } from "@/components/settings/BillingClient";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role || "VIEWER";
  const isOwner = session.user.isOrgOwner === true;

  // Only ADMIN, PROJECT_MANAGER, or org owner can view billing
  if (role !== "ADMIN" && role !== "PROJECT_MANAGER" && !isOwner) {
    redirect("/dashboard");
  }

  const [billingInfo, invoices, adminUsers] = await Promise.all([
    getBillingInfo(),
    getInvoiceHistory(),
    isOwner ? getOrgAdminUsers() : Promise.resolve([]),
  ]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your plan, view usage, and update payment details.
        </p>
      </div>

      <BillingClient
        billingInfo={billingInfo}
        invoices={invoices}
        adminUsers={adminUsers}
        isOwner={isOwner}
      />
    </div>
  );
}
