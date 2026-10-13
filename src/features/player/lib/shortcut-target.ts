/** Minimal element shape so the rule is testable without a DOM. */
export type TargetLike = {
  tagName?: string
  isContentEditable?: boolean
  type?: string
  closest?: (selector: string) => unknown
}

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'])

/** Typing into a field (search, chat, forms): player shortcuts must not steal the keys. */
export function isTypingTarget(el: TargetLike | null | undefined): boolean {
  if (!el?.tagName) return false
  if (el.isContentEditable) return true
  const tag = el.tagName.toUpperCase()
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true

  return tag === 'INPUT' && !NON_TEXT_INPUTS.has((el.type ?? 'text').toLowerCase())
}

/** Keys inside a dialog or menu that is not part of the player belong to that dialog (login modal, user menu). */
export function isForeignOverlayTarget(el: TargetLike | null | undefined): boolean {
  if (!el?.closest) return false

  return Boolean(el.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')) && !el.closest('[data-testid="player"]')
}

export function ignoresPlayerShortcut(el: TargetLike | null | undefined): boolean {
  return isTypingTarget(el) || isForeignOverlayTarget(el)
}
