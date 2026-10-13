import { useEffect, useState } from 'react'

/** Below this height difference the visual viewport shrank for a toolbar, not an on-screen keyboard. */
const KEYBOARD_MIN_PX = 150

function isTextEntry(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'].includes(el.type)

  return el instanceof HTMLElement && el.isContentEditable
}

/** NXL-C BR33: the bottom nav hides in fullscreen and while the on-screen keyboard is open. */
export function useBottomNavHidden(): boolean {
  const [fullscreen, setFullscreen] = useState(false)
  const [keyboard, setKeyboard] = useState(false)

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement !== null)
    const vv = window.visualViewport
    const check = () => {
      const shrunk = vv ? window.innerHeight - vv.height > KEYBOARD_MIN_PX : false
      setKeyboard(shrunk || isTextEntry(document.activeElement))
    }
    // focusout fires before focus moves on; read the new active element after it settles.
    const onFocusOut = () => window.setTimeout(check, 0)

    document.addEventListener('fullscreenchange', onFullscreen)
    document.addEventListener('focusin', check)
    document.addEventListener('focusout', onFocusOut)
    vv?.addEventListener('resize', check)

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen)
      document.removeEventListener('focusin', check)
      document.removeEventListener('focusout', onFocusOut)
      vv?.removeEventListener('resize', check)
    }
  }, [])

  return fullscreen || keyboard
}
