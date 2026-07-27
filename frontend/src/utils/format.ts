// Formatters, Storage, and JWT helpers for Mbamager

/**
 * Format a number as Central African CFA Franc (XAF) currency
 */
export function formatXAF(amount: number | string): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(value)) return '0 FCFA';
  return new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value).replace('FCFA', 'FCFA').trim();
}

/**
 * Format date to standard readable format
 * e.g., '18 Jul 2026' or with time if requested
 */
export function formatDate(dateString: string | Date, includeTime = false): string {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '';
  
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return new Intl.DateTimeFormat('en-GB', options).format(date);
}

/**
 * Format phone number to standard Cameroon format (+237 XXXXXXXX)
 */
export function formatCameroonPhone(phone: string): string {
  // Strip non-digit characters except leading plus
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it starts with +237, capture the trailing 9 digits
  if (cleaned.startsWith('+237') && cleaned.length === 13) {
    return `+237 ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)} ${cleaned.slice(10)}`;
  }
  
  // If it starts with 237, prefix with + and format
  if (cleaned.startsWith('237') && cleaned.length === 12) {
    return `+237 ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }
  
  // If it's a 9-digit local number, add +237
  if (cleaned.length === 9) {
    return `+237 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  
  return phone;
}

/**
 * Helper to parse JWT tokens and decode payload without external library dependencies
 */
export interface JWTPayload {
  sub: string; // Typically user_id or phone_number
  exp: number; // Expiry timestamp in seconds
  username?: string;
  [key: string]: any;
}

export function parseJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = parseJWT(token);
  if (!payload) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * Typed Local Storage wrapper
 */
export const storage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  
  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error writing to localStorage', e);
    }
  },
  
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.error('Error removing from localStorage', e);
    }
  },
  
  clear(): void {
    try {
      window.localStorage.clear();
    } catch (e) {
      console.error('Error clearing localStorage', e);
    }
  }
};

/**
 * "Remember Me"-aware storage for auth state (access token, refresh token,
 * cached user profile). When remembered, values live in localStorage and
 * survive a full browser restart. When not remembered, values live in
 * sessionStorage and are cleared the moment the tab/browser closes.
 * get() checks both so a session started either way is still readable.
 */
export const authStorage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const fromLocal = window.localStorage.getItem(key);
      if (fromLocal !== null) return JSON.parse(fromLocal) as T;
      const fromSession = window.sessionStorage.getItem(key);
      if (fromSession !== null) return JSON.parse(fromSession) as T;
      return defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T, remember: boolean): void {
    try {
      const serialized = JSON.stringify(value);
      if (remember) {
        window.localStorage.setItem(key, serialized);
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, serialized);
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Error writing auth storage', e);
    }
  },

  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch (e) {
      console.error('Error removing auth storage', e);
    }
  },

  /**
   * Whether the current session was stored to persist across browser
   * restarts. Defaults to true so existing (pre-this-feature) sessions
   * that only ever wrote to localStorage keep working.
   */
  isRemembered(): boolean {
    try {
      const flag = window.localStorage.getItem('mb_remember_session');
      return flag === null ? true : flag === 'true';
    } catch {
      return true;
    }
  },

  setRemembered(remember: boolean): void {
    try {
      window.localStorage.setItem('mb_remember_session', String(remember));
    } catch (e) {
      console.error('Error writing session persistence flag', e);
    }
  },
};
