import { apiRequest } from '@/lib/api-client'
import type { Me, MeUpdate, Session, User } from '@/features/auth/types'

export type RegisterBody = {
  username: string
  displayName?: string
  email: string
  password: string
  acceptTerms: boolean
}

export type LoginBody = {
  /** Email or username. */
  login: string
  password: string
}

export type ChangePasswordBody = {
  currentPassword: string
  newPassword: string
}

// The refresh cookie is SameSite=Strict; identity also requires this header on refresh/logout (CSRF, TSD S6).
const CLIENT_HEADER = { 'X-NXL-Client': 'web' }

export const authApi = {
  register: (body: RegisterBody) => apiRequest<Session>('/v1/auth/register', { method: 'POST', body }),
  login: (body: LoginBody) => apiRequest<Session>('/v1/auth/login', { method: 'POST', body }),
  refresh: () => apiRequest<Session>('/v1/auth/refresh', { method: 'POST', headers: CLIENT_HEADER }),
  logout: () => apiRequest<void>('/v1/auth/logout', { method: 'POST', headers: CLIENT_HEADER }),
  verifyEmail: (token: string) => apiRequest<{ user: User } | User>('/v1/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: () => apiRequest<void>('/v1/auth/verify-email/resend', { method: 'POST', auth: true }),
  forgotPassword: (email: string) => apiRequest<void>('/v1/auth/password/forgot', { method: 'POST', body: { email } }),
  resetPassword: (token: string, password: string) =>
    apiRequest<void>('/v1/auth/password/reset', { method: 'POST', body: { token, password } }),
}

export const meApi = {
  get: () => apiRequest<Me>('/v1/me', { auth: true }),
  update: (body: MeUpdate) => apiRequest<Me>('/v1/me', { method: 'PATCH', body, auth: true }),
  changePassword: (body: ChangePasswordBody) => apiRequest<Session>('/v1/me/password', { method: 'POST', body, auth: true }),
}
