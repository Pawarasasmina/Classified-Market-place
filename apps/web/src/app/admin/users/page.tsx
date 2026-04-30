'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../store/auth-store';

type AdminUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { token, user, hydrate, logout } = useAuthStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState('');

  const loadUsers = async () => {
    const { data } = await api.get('/users');
    setUsers(data);
  };

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }
    if (user?.role !== 'admin') {
      router.replace('/marketplace');
      return;
    }

    loadUsers().catch(() => {
      logout();
      router.replace('/login');
    });
  }, [token, user, router, logout]);

  const updateRole = async (id: string, role: string) => {
    await api.patch(`/users/${id}`, { role });
    setMessage('User updated');
    await loadUsers();
  };

  const deleteUser = async (id: string) => {
    await api.delete(`/users/${id}`);
    setMessage('User deleted');
    await loadUsers();
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Admin User Management</h1>
          <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white" onClick={logout}>Logout</button>
        </div>

        {message ? <p className="mb-4 text-sm text-green-700">{message}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{u.name}</td>
                  <td className="px-2 py-2">{u.email}</td>
                  <td className="px-2 py-2">
                    <select
                      className="rounded border border-slate-300 px-2 py-1"
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      className="rounded bg-red-600 px-3 py-1 text-white"
                      onClick={() => deleteUser(u.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}