"use client";

import { logoutAllAction, revokeSessionAction } from "@/app/(main)/actions";

type AuthSession = {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

export function SessionsList({ sessions }: { sessions: AuthSession[] }) {
  return (
    <div className="grid gap-4">
      {sessions.length ? (
        sessions.map((session) => (
          <article key={session.id} className="panel grid gap-3">
            <div>
              <h2 className="text-lg font-black">
                {session.deviceName || session.userAgent || "Unknown device"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                IP {session.ipAddress || "unknown"} | Started{" "}
                {new Date(session.createdAt).toLocaleString()} | Last used{" "}
                {new Date(session.lastUsedAt).toLocaleString()} | Expires{" "}
                {new Date(session.expiresAt).toLocaleString()}
              </p>
              {session.userAgent &&
              session.deviceName &&
              session.deviceName !== session.userAgent ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {session.userAgent}
                </p>
              ) : null}
            </div>
            <form action={revokeSessionAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <button className="action-secondary px-4 py-2 text-sm font-bold">
                Revoke session
              </button>
            </form>
          </article>
        ))
      ) : (
        <div className="panel text-sm text-[var(--muted)]">
          No active sessions found.
        </div>
      )}

      <form action={logoutAllAction} className="panel">
        <button className="rounded-full border border-red-300 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 hover:border-red-500">
          Log out from all devices
        </button>
      </form>
    </div>
  );
}
