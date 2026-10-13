/** NXL-C AF11: a dismissed Creator CTA stays hidden for `CTA_DISMISS_DAYS` on this device. */
export const CTA_DISMISS_DAYS = 30
export const CTA_DISMISS_KEY = 'nxl.creatorCta.dismissedAt'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function isCtaDismissed(s: StorageLike | null = storage(), now = Date.now()): boolean {
  try {
    const at = Number(s?.getItem(CTA_DISMISS_KEY))

    return Number.isFinite(at) && at > 0 && now - at < CTA_DISMISS_DAYS * 86_400_000
  } catch {
    return false
  }
}

export function dismissCta(s: StorageLike | null = storage(), now = Date.now()) {
  try {
    s?.setItem(CTA_DISMISS_KEY, String(now))
  } catch {
    // hidden until reload only
  }
}
