import { describe, expect, it } from 'vitest'
import { changePasswordSchema, registerSchema, resetPasswordSchema } from './auth-schemas'

const valid = { username: 'minh_01', email: 'm@example.com', password: 'passw0rdx', confirmPassword: 'passw0rdx', acceptTerms: true }

function messages(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((i) => [i.path.join('.'), i.message]))
}

describe('registerSchema', () => {
  it('accepts a valid form', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })

  it('requires acceptTerms (13+ and terms)', () => {
    expect(messages(registerSchema.safeParse({ ...valid, acceptTerms: false }))).toEqual({ acceptTerms: 'auth:validation.acceptTerms' })
  })

  it('checks username, password and confirmation', () => {
    const m = messages(registerSchema.safeParse({ ...valid, username: 'a!', password: 'abcdefgh', confirmPassword: 'x' }))
    expect(m.username).toBe('auth:validation.username')
    expect(m.password).toBe('auth:validation.passwordComposition')
  })
})

describe('resetPasswordSchema', () => {
  it('needs matching passwords', () => {
    expect(resetPasswordSchema.safeParse({ password: 'passw0rdx', confirmPassword: 'passw0rdx' }).success).toBe(true)
    expect(messages(resetPasswordSchema.safeParse({ password: 'passw0rdx', confirmPassword: 'passw0rdy' }))).toEqual({
      confirmPassword: 'auth:validation.passwordMismatch',
    })
  })
})

describe('changePasswordSchema', () => {
  it('rejects reusing the current password', () => {
    const m = messages(changePasswordSchema.safeParse({ currentPassword: 'passw0rdx', newPassword: 'passw0rdx', confirmPassword: 'passw0rdx' }))
    expect(m.newPassword).toBe('auth:validation.samePassword')
  })
})
