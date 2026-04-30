'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '../store/auth-store';

export default function HomePage() {
  const router = useRouter();
  const { user, token, hydrate, logout } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!token) return;
    if (user?.role === 'admin') {
      router.replace('/admin/users');
      return;
    }
    router.replace('/marketplace');
  }, [token, user, router]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-3xl font-bold text-slate-900">Classified Marketplace</h1>
        <p className="mt-3 text-slate-600">MVP auth and profile foundation is ready for web and backend.</p>

        <div className="mt-6 flex flex-wrap gap-3">
          {!token ? (
            <>
              <Link className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href="/login">
                Login
              </Link>
              <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900" href="/register">
                Register
              </Link>
            </>
          ) : (
            <>
              <Link className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href={user?.role === 'admin' ? '/admin/users' : '/marketplace'}>
                Continue
              </Link>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900" onClick={logout}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}