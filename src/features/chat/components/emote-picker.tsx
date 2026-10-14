import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useEmotes, useRecentEmotes } from '@/features/chat/hooks/use-emotes'
import type { Emote } from '@/features/chat/types'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'

const COLUMNS = 8

/** Arrow keys move between emotes of one grid (AF01 / §9B keyboard support). */
function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
  const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-emote]')]
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (at < 0) return
  const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }
  const delta = step[e.key]
  if (delta === undefined) return
  e.preventDefault()
  buttons[Math.min(buttons.length - 1, Math.max(0, at + delta))]?.focus()
}

function EmoteGrid({ title, emotes, onPick }: { title: string; emotes: readonly Emote[]; onPick: (e: Emote, keepOpen: boolean) => void }) {
  if (emotes.length === 0) return null

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-label-sm text-subtle-foreground">{title}</h3>
      <div className="grid grid-cols-8 gap-1" onKeyDown={onGridKey}>
        {emotes.map((e) => (
          <button
            key={e.id}
            type="button"
            data-emote={e.code}
            title={e.code}
            aria-label={e.code}
            onClick={(ev) => onPick(e, ev.shiftKey)}
            className="grid size-9 place-items-center rounded-control outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            <img src={e.imageUrl} alt="" loading="lazy" draggable={false} className="size-7 motion-reduce:animate-none" />
          </button>
        ))}
      </div>
    </section>
  )
}

function PickerBody({ onPick }: { onPick: (e: Emote, keepOpen: boolean) => void }) {
  const { t } = useTranslation('chat')
  const { emotes, isPending, isError } = useEmotes()
  const { recent, remember } = useRecentEmotes(emotes)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const found = useMemo(() => (q ? emotes.filter((e) => e.code.toLowerCase().includes(q)) : emotes), [emotes, q])

  const pick = (e: Emote, keepOpen: boolean) => {
    remember(e.code)
    onPick(e, keepOpen)
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('emote.search')}
        aria-label={t('emote.search')}
        className="h-9 rounded-lg border bg-surface px-3 text-body-md text-foreground outline-none placeholder:text-subtle-foreground focus-visible:border-ring"
      />
      <div className="flex max-h-56 flex-col gap-3 overflow-y-auto">
        {isError && <p className="text-body-sm text-muted-foreground">{t('emote.loadFailed')}</p>}
        {!isPending && !isError && found.length === 0 && <p className="text-body-sm text-muted-foreground">{t('emote.none')}</p>}
        {!q && <EmoteGrid title={t('emote.recent')} emotes={recent} onPick={pick} />}
        <EmoteGrid title={t('emote.global')} emotes={found} onPick={pick} />
      </div>
    </div>
  )
}

type Props = {
  disabled: boolean
  onPick: (code: string) => void
  /** Focus goes back to the input after picking. */
  onClose: () => void
  trigger: ReactNode
}

/** Chat/Emote Picker: a 320 px popover on desktop, a bottom sheet on mobile (brief C0, C3). */
export function EmotePicker({ disabled, onPick, onClose, trigger }: Props) {
  const { t } = useTranslation('chat')
  const desktop = useMediaQuery(MEDIA.md)
  const [open, setOpen] = useState(false)
  const closing = useRef(false)

  const pick = (e: Emote, keepOpen: boolean) => {
    onPick(e.code)
    // Shift keeps the picker open for several emotes (AF01 step 3).
    if (!keepOpen) {
      closing.current = true
      setOpen(false)
      onClose()
    }
  }
  const change = (next: boolean) => {
    setOpen(next)
    if (!next) onClose()
  }

  if (!desktop) {
    return (
      <Sheet open={open} onOpenChange={change}>
        <SheetTrigger asChild disabled={disabled}>
          {trigger}
        </SheetTrigger>
        <SheetContent side="bottom" className="gap-3 rounded-t-xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetTitle className="text-body-lg">{t('emote.title')}</SheetTitle>
          <SheetDescription className="sr-only">{t('emote.search')}</SheetDescription>
          <PickerBody onPick={pick} />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-80 p-3"
        aria-label={t('emote.title')}
        onCloseAutoFocus={(e) => {
          // Back to the input, not the emote button, after a pick.
          if (closing.current) e.preventDefault()
          closing.current = false
        }}
      >
        <PickerBody onPick={pick} />
      </PopoverContent>
    </Popover>
  )
}
