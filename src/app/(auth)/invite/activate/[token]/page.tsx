/**
 * @file src/app/(auth)/invite/activate/[token]/page.tsx
 * @description Account activation page for new users invited by an admin.
 * Looks up the AccountInvitation by token; renders ActivateAccountForm if valid.
 */

import { getAccountInvitationByToken } from "@/actions/userInvitations";
import { notFound } from "next/navigation";
import { ActivateAccountForm } from "@/components/auth/ActivateAccountForm";

export default async function ActivateAccountPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await getAccountInvitationByToken(token);
  if (!invite) notFound();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        <ActivateAccountForm token={token} invite={invite} />
      </div>
    </div>
  );
}
