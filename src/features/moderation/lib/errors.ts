import { detailString, errorCode } from '@/lib/api-error'

export type ModAction = 'delete' | 'timeout' | 'ban' | 'untimeout' | 'unban' | 'pin' | 'unpin' | 'role'

export type ModErrorKey = 'error.protected' | 'error.forbidden' | 'error.pinInvalid' | 'error.alreadyBanned' | 'error.readOnly' | 'error.failed'

/**
 * A refused moderation call → the toast of design 03e cells 13–16, and whether the tools should hide (the role
 * was removed meanwhile: plain FORBIDDEN, not a protected target).
 */
export function modError(err: unknown, action: ModAction): { key: ModErrorKey; lostRole: boolean } {
  const code = errorCode(err)
  if (code === 'FORBIDDEN') {
    return detailString(err, 'target') === 'PROTECTED' ? { key: 'error.protected', lostRole: false } : { key: 'error.forbidden', lostRole: true }
  }
  if (code === 'CHAT_READ_ONLY') return { key: 'error.readOnly', lostRole: false }
  if (code === 'INVALID_STATE') {
    if (action === 'pin') return { key: 'error.pinInvalid', lostRole: false }
    if (action === 'timeout') return { key: 'error.alreadyBanned', lostRole: false }
  }

  return { key: 'error.failed', lostRole: false }
}
