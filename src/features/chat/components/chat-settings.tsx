import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SettingsIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { chatApi } from '@/features/chat/api/chat-api'
import { useModeText } from '@/features/chat/hooks/use-mode-text'
import { FOLLOWERS_OPTIONS, SLOW_OPTIONS } from '@/features/chat/lib/constants'
import type { ChatMode } from '@/features/chat/types'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { useMessage } from '@/i18n/messages'
import { errorKeyOf } from '@/lib/error-messages'

const SELECT_CLASS =
  'h-10 w-full rounded-lg border bg-surface px-3 text-body-md text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 max-md:h-11'

function SettingsForm({ channelId, mode }: { channelId: string; mode: ChatMode }) {
  const { t } = useTranslation('chat')
  const msg = useMessage()
  const text = useModeText()
  const slowId = useId()
  const followersId = useId()
  const subsId = useId()
  // Shown at once; the room's `mode_change` confirms it for everyone (AF05). Once the room's mode changes
  // (our change echoed, or another moderator's), the room is the truth again.
  const [shown, setShown] = useState<{ base: ChatMode; value: ChatMode } | null>(null)
  const current = shown && shown.base === mode ? shown.value : mode

  const update = useMutation({
    mutationFn: (next: ChatMode) => chatApi.updateSettings(channelId, next),
    onMutate: (next) => setShown({ base: mode, value: next }),
    onSuccess: (saved, next) => {
      setShown({ base: mode, value: { slowSec: saved.slowSec, followersMin: saved.followersMin, subsOnly: saved.subsOnly } })
      for (const line of text.toasts(next, mode)) toast.success(line)
    },
    onError: (err) => {
      setShown(null)
      toast.error(msg(errorKeyOf(err)))
    },
  })

  const change = (patch: Partial<ChatMode>) => update.mutate({ ...current, ...patch })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-muted-foreground">{t('settings.hint')}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={slowId} className="text-label-md text-foreground">
          {t('settings.slow')}
        </label>
        <select id={slowId} className={SELECT_CLASS} value={current.slowSec} disabled={update.isPending} onChange={(e) => change({ slowSec: Number(e.target.value) })} data-testid="chat-settings-slow">
          {SLOW_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 0 ? t('settings.off') : t('settings.seconds', { count: s })}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={followersId} className="text-label-md text-foreground">
          {t('settings.followers')}
        </label>
        <select
          id={followersId}
          className={SELECT_CLASS}
          value={current.followersMin === null ? 'off' : String(current.followersMin)}
          disabled={update.isPending}
          onChange={(e) => change({ followersMin: e.target.value === 'off' ? null : Number(e.target.value) })}
          data-testid="chat-settings-followers"
        >
          {FOLLOWERS_OPTIONS.map((m) => (
            <option key={m ?? 'off'} value={m === null ? 'off' : String(m)}>
              {m === null ? t('settings.off') : m === 0 ? t('settings.anyFollower') : text.duration(m)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={subsId} className="text-label-md text-foreground">
          {t('settings.subs')}
        </label>
        <Switch id={subsId} checked={current.subsOnly} disabled={update.isPending} onCheckedChange={(subsOnly) => change({ subsOnly })} />
      </div>
    </div>
  )
}

/** C4 · Cài đặt chế độ chat (Streamer / Moderator): applies at once, no Save button. */
export function ChatSettings({ channelId, mode }: { channelId: string; mode: ChatMode }) {
  const { t } = useTranslation('chat')
  const desktop = useMediaQuery(MEDIA.md)
  const trigger = (
    <button
      type="button"
      aria-label={t('settings.open')}
      title={t('settings.open')}
      className="grid size-9 place-items-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-md:size-11"
      data-testid="chat-settings"
    >
      <SettingsIcon className="size-5" aria-hidden />
    </button>
  )

  if (!desktop) {
    return (
      <Sheet>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="gap-4 rounded-t-xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetTitle>{t('settings.title')}</SheetTitle>
          <SheetDescription className="sr-only">{t('settings.hint')}</SheetDescription>
          <SettingsForm channelId={channelId} mode={mode} />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-80" aria-label={t('settings.title')}>
        <h3 className="mb-3 text-body-lg font-semibold text-foreground">{t('settings.title')}</h3>
        <SettingsForm channelId={channelId} mode={mode} />
      </PopoverContent>
    </Popover>
  )
}
