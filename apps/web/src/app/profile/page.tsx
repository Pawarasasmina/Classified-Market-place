'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth-store';

export default function ProfilePage() {
  const router = useRouter();
  const { token, user, hydrate, setAuth, logout } = useAuthStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }

    (async () => {
      const { data } = await api.get('/users/profile');
      setName(data.name || '');
      setPhone(data.phone || '');
      setAvatarUrl(data.avatarUrl || '');
      setAuth(token, data);
    })().catch(() => {
      logout();
      router.replace('/login');
    });
  }, [token, router, setAuth, logout]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Saving...');

    try {
      const { data } = await api.patch('/users/profile', { name, phone, avatarUrl });
      if (token) setAuth(token, data);
      setStatus('Profile updated');
    } catch {
      setStatus('Update failed');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={logout}>Logout</button>
        </div>

        <p className="mt-2 text-sm text-slate-600">Email: {user?.email}</p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Avatar URL" />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-white" type="submit">Save</button>
        </form>

        {status ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}
      </div>
    </main>
  );
}