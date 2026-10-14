import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { SearchBox } from '@/features/search/components/search-box'
import { useUiStore } from '@/stores/ui-store'

/** Ctrl/⌘+K from any page; "/" is left to the chat input (15a annotation). */
function useSearchShortcut(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      e.preventDefault()
      open()
    }
    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [open])
}

/**
 * 15a · Bảng tìm kiếm: 640 px dialog 96 px from the top over a 60 % scrim. Radix restores focus to where it was
 * on close (Esc or a choice).
 */
export function SearchPalette() {
  const { t } = useTranslation('search')
  const open = useUiStore((s) => s.searchOpen)
  const setOpen = useUiStore((s) => s.setSearchOpen)
  const location = useLocation()
  useSearchShortcut(() => setOpen(true))

  // A navigation (back button) closes it.
  useEffect(() => setOpen(false), [location.pathname, setOpen])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-4 flex max-h-[calc(100dvh-2rem)] translate-y-0 flex-col gap-0 overflow-hidden bg-surface p-0 sm:max-w-160 md:top-24"
        data-testid="search-palette"
      >
        <DialogTitle className="sr-only">{t('label')}</DialogTitle>
        {open && <SearchBox variant="palette" onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}
