'use client';

import { create } from 'zustand';

type User = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  setAuth: (token, user) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('authUser', JSON.stringify(user));
    set({ token, user, hydrated: true });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('authUser');
    set({ token: null, user: null, hydrated: true });
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('accessToken');
    const userJson = localStorage.getItem('authUser');
    if (!token || !userJson) {
      set({ token: null, user: null, hydrated: true });
      return;
    }

    try {
      const user = JSON.parse(userJson) as User;
      set({ token, user, hydrated: true });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('authUser');
      set({ token: null, user: null, hydrated: true });
    }
  },
}));