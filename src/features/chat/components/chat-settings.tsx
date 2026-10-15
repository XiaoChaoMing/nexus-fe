import { useState, type ReactElement } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { XIcon } from 'lucide-react'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { chatApi } from '@/features/chat/api/chat-api'
import { useModeText } from '@/features/chat/hooks/use-mode-text'
import { FOLLOWERS_OPTIONS, SLOW_OPTIONS } from '@/features/chat/lib/constants'
import type { ChatMode } from '@/features/chat/types'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

type ChipProps = { selected: boolean; pending: boolean; large: boolean; onClick: () => void; children: string }

/** Option chip of Chat/Mode Settings: selected = card fill + Electric Pulse hairline. */
function Chip({ selected, pending, large, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={pending}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center rounded-control border px-2.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-wait',
        large ? 'h-11 px-3 text-body-sm' : 'h-7.5 text-[12.5px]',
        selected ? 'border-primary bg-card font-semibold text-foreground' : 'border-border bg-surface font-medium text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={title}>
      <div className="flex flex-col gap-0.5">
        <p className="text-[13.5px] font-semibold text-foreground max-md:text-body-md">{title}</p>
        <p className="text-label-sm leading-4.25 font-normal text-muted-foreground max-md:text-[12.5px]">{desc}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

/**
 * Body of 03d · Cài đặt chế độ chat. A chip or the switch is sent at once (no Save); it shows as selected once the
 * server confirms, then the toast "Đã bật chế độ chậm 10 giây". A failure keeps the old value.
 */
function SettingsForm({ channelId, mode, large }: { channelId: string; mode: ChatMode; large: boolean }) {
  const { t } = useTranslation('chat')
  const text = useModeText()
  const [saved, setSaved] = useState<{ base: ChatMode; value: ChatMode } | null>(null)
  // Until the room's `mode_change` arrives (or if it never does), show what the server answered.
  const current = saved && saved.base === mode ? saved.value : mode

  // The previous mode travels with the request: the room's `mode_change` can arrive over the socket before this
  // response does, and comparing with the re-rendered mode would then find no change and show no toast.
  const update = useMutation({
    mutationFn: ({ next }: { next: ChatMode; prev: ChatMode }) => chatApi.updateSettings(channelId, next),
    onSuccess: (res, { next, prev }) => {
      setSaved({ base: mode, value: { slowSec: res.slowSec, followersMin: res.followersMin, subsOnly: res.subsOnly, blockLinks: res.blockLinks } })
      for (const line of text.toasts(next, prev)) toast.success(line)
    },
    onError: () => toast.error(t('settings.failed')),
  })

  const change = (patch: Partial<ChatMode>) => update.mutate({ next: { ...current, ...patch }, prev: current })
  const pending = update.isPending

  return (
    <div className="flex flex-col gap-4" data-testid="chat-settings-form">
      <Section title={t('settings.slow')} desc={t('settings.slowDesc')}>
        {SLOW_OPTIONS.map((s) => (
          <Chip key={s} large={large} pending={pending} selected={current.slowSec === s} onClick={() => change({ slowSec: s })}>
            {s === 0 ? t('settings.off') : t('settings.seconds', { count: s })}
          </Chip>
        ))}
      </Section>
      <div className="h-px bg-border" />
      <Section title={t('settings.followers')} desc={t('settings.followersDesc')}>
        {FOLLOWERS_OPTIONS.map((m) => (
          <Chip key={m ?? 'off'} large={large} pending={pending} selected={current.followersMin === m} onClick={() => change({ followersMin: m })}>
            {m === null ? t('settings.off') : m === 0 ? t('settings.anyFollower') : text.duration(m)}
          </Chip>
        ))}
      </Section>
      <div className="h-px bg-border" />
      <label className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold text-foreground max-md:text-body-md">{t('settings.subs')}</span>
          <span className="text-label-sm leading-4.25 font-normal text-muted-foreground max-md:text-[12.5px]">{t('settings.subsDesc')}</span>
        </span>
        <span className={cn('grid place-items-center', large && 'size-11')}>
          <Switch checked={current.subsOnly} disabled={pending} onCheckedChange={(subsOnly) => change({ subsOnly })} data-testid="chat-settings-subs" />
        </span>
      </label>
    </div>
  )
}

/** C4 · 03d: a 316 px popover under the column header on desktop, a bottom sheet on mobile. */
export function ChatSettings({ channelId, mode, trigger }: { channelId: string; mode: ChatMode; trigger: ReactElement }) {
  const { t } = useTranslation('chat')
  const desktop = useMediaQuery(MEDIA.md)
  const closeClass = 'grid place-items-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'

  if (!desktop) {
    return (
      <Sheet>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[85dvh] gap-4 overflow-y-auto rounded-t-xl px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="flex justify-center pb-1" aria-hidden>
            <span className="h-1 w-9 rounded-full bg-border" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-lg leading-6 font-semibold">{t('settings.title')}</SheetTitle>
            <SheetClose className={cn(closeClass, 'size-11')} aria-label={t('settings.close')}>
              <XIcon className="size-5.5" aria-hidden />
            </SheetClose>
          </div>
          <SheetDescription className="text-[12.5px] text-muted-foreground">{t('settings.hint')}</SheetDescription>
          <SettingsForm channelId={channelId} mode={mode} large />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-79 rounded-xl p-0" aria-label={t('settings.title')}>
        <div className="flex items-center gap-2 border-b py-3 pr-2 pl-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h3 className="text-[15px] font-semibold text-foreground">{t('settings.title')}</h3>
            <p className="text-label-sm font-normal text-muted-foreground">{t('settings.hint')}</p>
          </div>
          <PopoverClose className={cn(closeClass, 'size-8')} aria-label={t('settings.close')}>
            <XIcon className="size-4.5" aria-hidden />
          </PopoverClose>
        </div>
        <div className="p-4">
          <SettingsForm channelId={channelId} mode={mode} large={false} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
