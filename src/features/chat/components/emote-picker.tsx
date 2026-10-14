import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchIcon, XIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useEmotes, useRecentEmotes } from '@/features/chat/hooks/use-emotes'
import type { Emote } from '@/features/chat/types'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

const COLUMNS = 6

/** Arrow keys move between the emotes of one grid (AF01 / §9B keyboard support). */
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

type GridProps = { title: string; emotes: readonly Emote[]; large: boolean; onPick: (e: Emote) => void; onHover: (e: Emote | null) => void }

function EmoteGrid({ title, emotes, large, onPick, onHover }: GridProps) {
  if (emotes.length === 0) return null

  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {title} · {emotes.length}
      </h3>
      <div className={cn('grid grid-cols-6', large ? 'justify-between gap-y-2' : 'gap-2')} onKeyDown={onGridKey}>
        {emotes.map((e) => (
          <button
            key={e.id}
            type="button"
            data-emote={e.code}
            title={e.code}
            aria-label={e.code}
            onClick={() => onPick(e)}
            onMouseEnter={() => onHover(e)}
            onFocus={() => onHover(e)}
            className={cn(
              'grid place-items-center rounded-control outline-none hover:bg-accent hover:outline-2 hover:outline-primary focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-primary',
              large ? 'size-12' : 'size-10',
            )}
          >
            <img src={e.imageUrl} alt="" loading="lazy" draggable={false} className="size-7 motion-reduce:animate-none" />
          </button>
        ))}
      </div>
    </section>
  )
}

/** Chat/Emote Picker body: search, "Gần đây" (AF01), the global emotes and the hovered emote's name. */
function PickerBody({ onPick, large }: { onPick: (e: Emote) => void; large: boolean }) {
  const { t } = useTranslation('chat')
  const { emotes, isPending, isError } = useEmotes()
  const { recent, remember } = useRecentEmotes(emotes)
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState<Emote | null>(null)
  const q = query.trim().toLowerCase()
  const found = useMemo(() => (q ? emotes.filter((e) => e.code.toLowerCase().includes(q)) : emotes), [emotes, q])

  const pick = (e: Emote) => {
    remember(e.code)
    onPick(e)
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-2.5', !large && 'h-full')}>
      <label className={cn('flex shrink-0 items-center gap-2 rounded-lg bg-background px-2.5 outline outline-border focus-within:outline-2 focus-within:outline-primary', large ? 'h-11 px-3' : 'h-9')}>
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('emote.search')}
          aria-label={t('emote.search')}
          className={cn('min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground', large ? 'text-body-md' : 'text-body-sm')}
        />
      </label>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-0.5">
        {isError && <p className="text-body-sm text-muted-foreground">{t('emote.loadFailed')}</p>}
        {!isPending && !isError && found.length === 0 && <p className="text-body-sm text-muted-foreground">{t('emote.none')}</p>}
        {!q && <EmoteGrid title={t('emote.recent')} emotes={recent} large={large} onPick={pick} onHover={setHovered} />}
        <EmoteGrid title={t('emote.global')} emotes={found} large={large} onPick={pick} onHover={setHovered} />
      </div>
      {!large && (
        <div className="flex h-10 shrink-0 items-center gap-2.5 border-t pt-2.5" aria-live="polite">
          {hovered ? (
            <>
              <img src={hovered.imageUrl} alt="" className="size-7" />
              <span className="flex min-w-0 flex-col gap-px">
                <span className="truncate text-body-sm font-semibold text-foreground">{hovered.code}</span>
                <span className="text-[11.5px] text-muted-foreground">{t('emote.insertHint')}</span>
              </span>
            </>
          ) : (
            <span className="text-[11.5px] text-muted-foreground">{t('emote.insertHint')}</span>
          )}
        </div>
      )}
    </div>
  )
}

type Props = {
  disabled: boolean
  onPick: (code: string) => void
  /** Focus goes back to the input when the picker closes. */
  onClose: () => void
  trigger: ReactNode
}

/**
 * Chat/Emote Picker: a 320×280 popover above the input on desktop, a bottom sheet on mobile. A pick inserts the
 * code at the caret and the picker stays open; Esc or a click outside closes it (Components GĐ3 · Chat).
 */
export function EmotePicker({ disabled, onPick, onClose, trigger }: Props) {
  const { t } = useTranslation('chat')
  const desktop = useMediaQuery(MEDIA.md)
  const [open, setOpen] = useState(false)

  const change = (next: boolean) => {
    setOpen(next)
    if (!next) onClose()
  }
  const pick = (e: Emote) => onPick(e.code)

  if (!desktop) {
    return (
      <Sheet open={open} onOpenChange={change}>
        <SheetTrigger asChild disabled={disabled}>
          {trigger}
        </SheetTrigger>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[70dvh] gap-4 rounded-t-xl px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="flex justify-center pb-1" aria-hidden>
            <span className="h-1 w-9 rounded-full bg-border" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-lg leading-6 font-semibold">{t('emote.title')}</SheetTitle>
            <SheetClose className="grid size-11 place-items-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label={t('settings.close')}>
              <XIcon className="size-5.5" aria-hidden />
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">{t('emote.insertHint')}</SheetDescription>
          <PickerBody onPick={pick} large />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="h-70 w-80 rounded-xl bg-card p-3" aria-label={t('emote.title')} onCloseAutoFocus={(e) => e.preventDefault()}>
        <PickerBody onPick={pick} large={false} />
      </PopoverContent>
    </Popover>
  )
}
