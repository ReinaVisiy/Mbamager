import { create } from 'zustand';
import { User } from '../types';
import { authStorage, isTokenExpired } from '../utils/format';
import { authService } from '../services/auth';

interface AuthState {
  user: User | null; // For backward compatibility with existing code like Navbar
  currentUser: User | null; // For new components and spec compliance
  token: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (username: string, phone_number: string | null, password: string, email?: string | null) => Promise<void>;
  logout: () => void;
  restoreSession: () => boolean;
  loadCurrentUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: { username?: string; phone_number?: string; email?: string; password?: string }) => Promise<void>;
  /**
   * Move the already-active session between localStorage (persists across
   * browser restarts) and sessionStorage (cleared on tab/browser close)
   * without forcing a re-login.
   */
  setRememberSession: (remember: boolean) => void;
  isAuthenticated: () => boolean;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen for custom auth expired event
  if (typeof window !== 'undefined') {
    window.addEventListener('auth:expired', () => {
      get().logout();
    });
  }

  return {
    user: null,
    currentUser: null,
    token: null,
    isLoading: true,
    error: null,

    login: async (identifier, password, rememberMe = true) => {
      set({ isLoading: true, error: null });
      try {
        const tokenResp = await authService.login(identifier, password);
        const token = tokenResp.access_token;
        authStorage.setRemembered(rememberMe);
        authStorage.set('mb_auth_token', token, rememberMe);
        if (tokenResp.refresh_token) {
          authStorage.set('mb_refresh_token', tokenResp.refresh_token, rememberMe);
        }
        set({ token });
        
        // Fetch current user immediately
        const user = await authService.getCurrentUser();
        authStorage.set('mb_user_profile', user, rememberMe);
        
        set({
          user,
          currentUser: user,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        const message = err.message || 'Incorrect credentials or server offline.';
        set({ error: message, isLoading: false });
        throw err;
      }
    },

    register: async (username, phone_number, password, email = null) => {
      set({ isLoading: true, error: null });
      try {
        // 1. Submit registration request
        await authService.register(username, phone_number, password, email);
        
        // 2. Automatically log in after successful registration
        const loginIdentifier = email || phone_number;
        if (!loginIdentifier) {
          throw new Error('Registration succeeded, but login identifier is missing.');
        }
        const tokenResp = await authService.login(loginIdentifier, password);
        const token = tokenResp.access_token;
        // No Remember Me control at registration time - default to a
        // persisted session, matching prior behavior.
        authStorage.setRemembered(true);
        authStorage.set('mb_auth_token', token, true);
        if (tokenResp.refresh_token) {
          authStorage.set('mb_refresh_token', tokenResp.refresh_token, true);
        }
        set({ token });
        
        // 3. Fetch user profile
        const user = await authService.getCurrentUser();
        authStorage.set('mb_user_profile', user, true);
        
        set({
          user,
          currentUser: user,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        const message = err.message || 'Registration failed or user identifier already exists.';
        set({ error: message, isLoading: false });
        throw err;
      }
    },

    logout: () => {
      authStorage.remove('mb_auth_token');
      authStorage.remove('mb_refresh_token');
      authStorage.remove('mb_user_profile');
      set({
        token: null,
        user: null,
        currentUser: null,
        isLoading: false,
        error: null,
      });
    },

    restoreSession: () => {
      set({ isLoading: true });
      try {
        const token = authStorage.get<string | null>('mb_auth_token', null);
        const user = authStorage.get<User | null>('mb_user_profile', null);

        if (token && !isTokenExpired(token)) {
          set({
            token,
            user,
            currentUser: user,
            isLoading: false,
            error: null,
          });
          
          // Asynchronously refresh user info in the background
          get().refreshUser();
          return true;
        }
      } catch (err) {
        console.error('Failed to restore auth session', err);
      }
      
      authStorage.remove('mb_auth_token');
      authStorage.remove('mb_refresh_token');
      authStorage.remove('mb_user_profile');
      set({
        token: null,
        user: null,
        currentUser: null,
        isLoading: false,
      });
      return false;
    },

    loadCurrentUser: async () => {
      set({ isLoading: true, error: null });
      try {
        const user = await authService.getCurrentUser();
        authStorage.set('mb_user_profile', user, authStorage.isRemembered());
        set({
          user,
          currentUser: user,
          isLoading: false,
        });
      } catch (err: any) {
        authStorage.remove('mb_auth_token');
        authStorage.remove('mb_refresh_token');
        authStorage.remove('mb_user_profile');
        set({
          token: null,
          user: null,
          currentUser: null,
          isLoading: false,
          error: err.message || 'Session invalid.',
        });
      }
    },

    refreshUser: async () => {
      try {
        const user = await authService.getCurrentUser();
        authStorage.set('mb_user_profile', user, authStorage.isRemembered());
        set({
          user,
          currentUser: user,
        });
      } catch (err) {
        console.error('Background user refresh failed:', err);
      }
    },

    updateProfile: async (updates) => {
      const user = await authService.updateProfile(updates);
      authStorage.set('mb_user_profile', user, authStorage.isRemembered());
      set({
        user,
        currentUser: user,
      });
    },

    setRememberSession: (remember) => {
      const token = get().token || authStorage.get<string | null>('mb_auth_token', null);
      const refreshToken = authStorage.get<string | null>('mb_refresh_token', null);
      const user = get().currentUser || authStorage.get<User | null>('mb_user_profile', null);

      authStorage.setRemembered(remember);
      if (token) authStorage.set('mb_auth_token', token, remember);
      if (refreshToken) authStorage.set('mb_refresh_token', refreshToken, remember);
      if (user) authStorage.set('mb_user_profile', user, remember);
    },

    isAuthenticated: () => {
      const token = get().token || authStorage.get<string | null>('mb_auth_token', null);
      return !!token && !isTokenExpired(token) && !!get().currentUser;
    },

    clearError: () => set({ error: null }),
  };
});
