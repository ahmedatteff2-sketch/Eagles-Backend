import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@workspace/api-client-react';

/**
 * Auth state.
 *
 * The refresh token now lives in an httpOnly cookie set by the backend
 * (`eg_refresh`, scoped to /api/auth) and is no longer persisted to
 * localStorage. The field is kept on the type for backward compatibility
 * with existing call sites (login response shape, AdminLayout/MemberLayout
 * logout payload) — but its value is ignored: the browser sends the cookie
 * automatically on /api/auth/refresh and /api/auth/logout.
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  setAuth: (accessToken: string, refreshToken: string | null, user: UserProfile) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, _refreshToken, user) =>
        // Deliberately ignore the refresh token argument. It used to be
        // persisted alongside the access token; now it's a cookie.
        set({ accessToken, refreshToken: null, user }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'gym-auth-storage',
      version: 1,
      // v0 stored { accessToken, refreshToken, user }. v1 drops refreshToken
      // — anyone upgrading from v0 has their stale token wiped on first load
      // so it doesn't sit on disk forever.
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Partial<AuthState>;
        if (version < 1) {
          return { accessToken: state.accessToken ?? null, refreshToken: null, user: state.user ?? null };
        }
        return state as AuthState;
      },
      // Only persist the access token + user profile. Never write the
      // refresh token to localStorage — that's the whole point.
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    }
  )
);
