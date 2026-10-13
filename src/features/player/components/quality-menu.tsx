import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlayer } from '@/features/player/stores/player-store'

type Props = { onSelect: (index: number) => void }

/** UC-A02: Auto (ABR) or a fixed rendition; the button shows "Auto · 720p" while adapting. */
export function QualityMenu({ onSelect }: Props) {
  const { t } = useTranslation('player')
  const levels = usePlayer((s) => s.levels)
  const selected = usePlayer((s) => s.selectedLevel)
  const activeHeight = usePlayer((s) => s.activeHeight)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)

    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (levels.length === 0) return null

  const fixed = levels.find((l) => l.index === selected)
  const label = fixed ? `${fixed.height}p` : `${t('auto')}${activeHeight ? ` · ${activeHeight}p` : ''}`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('qualityValue', { value: label })}
        onClick={() => setOpen((o) => !o)}
        className="h-9 rounded-button px-2 text-xs font-semibold text-fg hover:bg-white/10"
      >
        {label}
      </button>
      {open && (
        <ul role="menu" className="absolute bottom-11 right-0 min-w-36 rounded-panel border border-border bg-surface-1 py-1 shadow-lg">
          {[{ index: -1, label: t('auto') }, ...levels.map((l) => ({ index: l.index, label: `${l.height}p` }))].map((o) => (
            <li key={o.index} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selected === o.index}
                onClick={() => {
                  onSelect(o.index)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2 ${
                  selected === o.index ? 'text-primary' : 'text-fg'
                }`}
              >
                {o.label}
                {selected === o.index && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
