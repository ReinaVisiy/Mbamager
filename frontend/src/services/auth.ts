import { api } from '../lib/api';
import { User } from '../types';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string | null;
}

export const authService = {
  /**
   * Log in user with phone number or email and password.
   * Matches FastAPI backend spec: returns TokenResponse.
   */
  async login(identifier: string, password: string): Promise<TokenResponse> {
    const payload = { identifier, password };
    const response = await api.post<TokenResponse>('/auth/login', payload);
    return response.data;
  },

  /**
   * Register a new user.
   * Matches FastAPI backend spec: returns User.
   */
  async register(username: string, phone_number: string | null, password: string, email: string | null = null): Promise<User> {
    const payload = { username, phone_number, password, email };
    const response = await api.post<User>('/auth/register', payload);
    return response.data;
  },

  /**
   * Initiate the forgot password process.
   */
  async forgotPassword(identifier: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/forgot-password', { identifier });
    return response.data;
  },

  /**
   * Verify the OTP code.
   */
  async verifyOtp(identifier: string, code: string): Promise<{ reset_token: string }> {
    const response = await api.post<{ reset_token: string }>('/auth/verify-otp', { identifier, code });
    return response.data;
  },

  /**
   * Reset the password with the temporary reset token.
   */
  async resetPassword(identifier: string, resetToken: string, newPassword: string): Promise<{ status: string, message: string }> {
    const response = await api.post<{ status: string, message: string }>('/auth/reset-password', {
      identifier,
      reset_token: resetToken,
      new_password: newPassword,
    });
    return response.data;
  },

  /**
   * Exchange a refresh token for a new access/refresh token pair.
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await api.post<TokenResponse>('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  },

  /**
   * Fetch current authenticated user profile.
   * Matches FastAPI backend spec: returns User.
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  /**
   * Update the current authenticated user's profile. Only send the fields
   * that should change - the backend applies a partial update.
   */
  async updateProfile(updates: {
    username?: string;
    phone_number?: string;
    email?: string;
    password?: string;
  }): Promise<User> {
    const response = await api.patch<User>('/auth/me', updates);
    return response.data;
  },

  /**
   * Performs client-side session clean-up.
   */
  async logout(): Promise<void> {
    return Promise.resolve();
  },
};
