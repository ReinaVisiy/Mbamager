import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { authStorage } from '../utils/format';

// Core API client configuration
const API_TIMEOUT = 15000; // 15 seconds

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || '/api/v1',
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Inject JWT token automatically
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = authStorage.get<string | null>('mb_auth_token', null);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(normalizeError(error));
  }
);

// Endpoints that must never trigger a refresh-and-retry cycle themselves,
// since a 401 from these means the session truly cannot be recovered.
const AUTH_ENDPOINTS_NO_RETRY = ['/auth/login', '/auth/register', '/auth/refresh'];

function forceLogout(): void {
  authStorage.remove('mb_auth_token');
  authStorage.remove('mb_refresh_token');
  authStorage.remove('mb_user_profile');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
}

// Concurrent requests that 401 while a refresh is already in-flight share
// the same refresh call instead of each firing their own.
let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = authStorage.get<string | null>('mb_refresh_token', null);
  if (!refreshToken) return null;

  // Rotated tokens are written back to whichever storage (local vs
  // session) the current session was started in.
  const remember = authStorage.isRemembered();

  try {
    const response = await axios.post(
      `${api.defaults.baseURL}/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const { access_token, refresh_token: newRefreshToken } = response.data;
    authStorage.set('mb_auth_token', access_token, remember);
    if (newRefreshToken) {
      authStorage.set('mb_refresh_token', newRefreshToken, remember);
    }
    return access_token as string;
  } catch {
    return null;
  }
}

// Response Interceptor: on a 401, try to refresh the session once and
// replay the original request; only force a logout if refresh itself fails
// or the request has already been retried.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const url = originalRequest?.url || '';
    const isAuthEndpoint = AUTH_ENDPOINTS_NO_RETRY.some((path) => url.includes(path));

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = performRefresh().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;

      if (newAccessToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      }

      forceLogout();
    } else if (status === 401) {
      forceLogout();
    }
    
    return Promise.reject(normalizeError(error));
  }
);

/**
 * Standardize API error shapes to avoid handling different axios structures in components
 */
export function normalizeError(error: any): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;
    
    return {
      message: data?.detail || data?.message || error.message || 'An unexpected API error occurred',
      code: data?.error_code || 'API_ERROR',
      status: error.response?.status,
      details: data?.details || null,
    };
  }
  
  return {
    message: error.message || 'A network error occurred. Please check your connection.',
    code: 'NETWORK_ERROR',
  };
}
