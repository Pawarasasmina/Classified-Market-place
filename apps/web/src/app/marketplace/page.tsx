'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/auth-store';

export default function MarketplacePage() {
  const router = useRouter();
  const { token, user, hydrate, logout } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!token) router.replace('/login');
    if (user?.role === 'admin') router.replace('/admin/users');
  }, [token, user, router]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-white px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Marketplace Home</h1>
          <div className="flex gap-2">
            <Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm" href="/profile">Profile</Link>
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white" onClick={logout}>Logout</button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {['Cars', 'Properties', 'Electronics', 'Jobs', 'Services', 'Furniture'].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{item}</h2>
              <p className="mt-2 text-sm text-slate-600">Sample category card for MVP customer landing page.</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}