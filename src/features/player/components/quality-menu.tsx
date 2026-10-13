import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, Settings2Icon } from 'lucide-react'
import { usePlayer } from '@/features/player/stores/player-store'
import { cn } from '@/lib/utils'

type Props = { onSelect: (index: number) => void; className?: string }

/**
 * Player/Quality Menu (03b state 12): "Tự động (720p)" or a fixed rendition, anchored above the button. Closes on
 * selection, outside click or Esc; arrow keys move between items. Only the renditions in the stream are listed.
 */
export function QualityMenu({ onSelect, className }: Props) {
  const { t } = useTranslation('player')
  const levels = usePlayer((s) => s.levels)
  const selected = usePlayer((s) => s.selectedLevel)
  const activeHeight = usePlayer((s) => s.activeHeight)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return

    const close = (e: MouseEvent | TouchEvent) => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) setOpen(false)
    }
    // Capture phase: Esc closes the menu before the player's Esc (exit theater/fullscreen) sees it.
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', onKey, true)
    listRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()

    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  if (levels.length === 0) return null

  const fixed = levels.find((l) => l.index === selected)
  const autoLabel = activeHeight ? t('autoWith', { height: `${activeHeight}p` }) : t('auto')
  const buttonText = fixed ? `${fixed.height}p` : activeHeight ? `${activeHeight}p` : t('auto')
  const options = [{ index: -1, label: autoLabel }, ...levels.map((l) => ({ index: l.index, label: `${l.height}p` }))]

  const moveFocus = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    e.stopPropagation()
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])]
    const at = items.findIndex((el) => el === document.activeElement)
    const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('qualityValue', { value: fixed ? `${fixed.height}p` : autoLabel })}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-11 items-center gap-1 rounded-control px-2 text-body-sm font-semibold text-foreground hover:bg-white/10 md:h-9',
          open && 'bg-accent',
        )}
      >
        <Settings2Icon className="size-5" aria-hidden />
        {buttonText}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full z-10 mb-2 w-55 rounded-xl border bg-card p-1.5">
          <p className="px-2.5 pt-2 pb-1.5 text-label-sm font-semibold tracking-wide text-subtle-foreground" aria-hidden>
            {t('quality')}
          </p>
          <ul ref={listRef} role="menu" aria-label={t('quality')} onKeyDown={moveFocus}>
            {options.map((o) => {
              const checked = selected === o.index

              return (
                <li key={o.index} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={checked}
                    onClick={() => {
                      onSelect(o.index)
                      setOpen(false)
                      buttonRef.current?.focus()
                    }}
                    className={cn(
                      'flex h-10 w-full items-center justify-between rounded-control px-2.5 text-left text-body-md hover:bg-accent hover:text-foreground',
                      checked ? 'bg-accent font-semibold text-foreground' : 'font-medium text-muted-foreground',
                    )}
                  >
                    {o.label}
                    {checked && <CheckIcon className="size-5 text-primary" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
