import { z } from 'zod'

// Messages are i18n keys; forms translate them when rendering (see useMessage).
const v = {
  required: 'auth:validation.required',
  username: 'auth:validation.username',
  email: 'auth:validation.email',
  passwordLength: 'auth:validation.passwordLength',
  passwordComposition: 'auth:validation.passwordComposition',
  passwordMismatch: 'auth:validation.passwordMismatch',
  acceptTerms: 'auth:validation.acceptTerms',
  samePassword: 'auth:validation.samePassword',
} as const

// Mirrors the identity-svc validator and the users table CHECK; keep both sides in sync.
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,25}$/

export const passwordSchema = z
  .string()
  .min(8, v.passwordLength)
  .max(72, v.passwordLength)
  .refine((p) => /\p{L}/u.test(p) && /\p{N}/u.test(p), v.passwordComposition)

export const emailSchema = z.string().trim().min(1, v.required).max(254, v.email).pipe(z.email(v.email))

export const registerSchema = z
  .object({
    username: z.string().trim().regex(USERNAME_PATTERN, v.username),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, v.required),
    // NXL-D §3.1: self-declared 13+ and terms; identity rejects the request without it.
    acceptTerms: z.boolean().refine((x) => x, v.acceptTerms),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: v.passwordMismatch })

export const loginSchema = z.object({
  login: z.string().trim().min(1, v.required).max(254, v.required),
  password: z.string().min(1, v.required).max(72, v.passwordLength),
})

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string().min(1, v.required) })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: v.passwordMismatch })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, v.required).max(72, v.passwordLength),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, v.required),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: v.passwordMismatch })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ['newPassword'], message: v.samePassword })

export type RegisterForm = z.infer<typeof registerSchema>
export type LoginForm = z.infer<typeof loginSchema>
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>
