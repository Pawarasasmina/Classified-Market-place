import Link from "next/link";
import { SessionsList } from "@/components/marketplace/sessions-list";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAuthSessions } from "@/lib/marketplace-api";

export default async function SessionsPage() {
  const { accessToken } = await requireSessionContext("/profile/sessions");
  const sessions = await fetchAuthSessions(accessToken);

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Account security</p>
        <h1 className="mt-3 text-3xl font-black text-white">Active sessions</h1>
        <p className="mt-2 text-[#d7d9ea]">
          Review signed-in devices and revoke access you no longer recognize.
        </p>
      </div>
      <Link href="/profile" className="action-secondary w-fit px-4 py-2 text-sm font-bold">
        Back to profile
      </Link>
      <SessionsList sessions={sessions} />
    </div>
  );
}
