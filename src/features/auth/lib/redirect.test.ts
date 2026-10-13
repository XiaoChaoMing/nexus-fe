import { describe, expect, it } from 'vitest'
import { loginPath, redirectTarget } from './redirect'

describe('redirectTarget', () => {
  it('prefers ?returnTo= over router state, both sanitized', () => {
    expect(redirectTarget({ from: '/studio/stream' }, '?returnTo=%2Flive%2Fabc')).toBe('/live/abc')
    expect(redirectTarget({ from: '/studio/stream' }, '')).toBe('/studio/stream')
    expect(redirectTarget(null, '?returnTo=%2F%2Fevil.example')).toBe('/')
    expect(redirectTarget({ from: 'https://evil.example' })).toBe('/')
    expect(redirectTarget(undefined)).toBe('/')
  })
})

describe('loginPath', () => {
  it('adds an encoded returnTo except for home', () => {
    expect(loginPath('/creator/apply?x=1')).toBe('/login?returnTo=%2Fcreator%2Fapply%3Fx%3D1')
    expect(loginPath('/')).toBe('/login')
    expect(loginPath('//evil')).toBe('/login')
    expect(loginPath('/following', 'register')).toBe('/register?returnTo=%2Ffollowing')
  })
})
