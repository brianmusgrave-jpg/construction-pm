import { getInvitationByToken } from "@/actions/invitations";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { AcceptInvitation } from "@/components/project/AcceptInvitation";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await getInvitationByToken(token);
  if (!invite) notFound();

  const session = await auth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        <AcceptInvitation
          token={token}
          invite={invite}
          isLoggedIn={!!session?.user}
        />
      </div>
    </div>
  );
}
