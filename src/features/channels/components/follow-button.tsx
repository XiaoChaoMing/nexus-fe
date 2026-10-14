import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BellIcon, BellOffIcon, BellRingIcon, CheckIcon, HeartIcon, PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useFollow } from '@/features/channels/hooks/use-follow'
import { channelName } from '@/features/channels/lib/channel-display'
import type { FollowCacheValue } from '@/features/channels/lib/follow-cache'
import { bellKind } from '@/features/channels/lib/follow-state'
import { NOTIFY_LEVELS, type NotifyLevel } from '@/features/channels/types'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

type FollowChannel = { id: string; handle: string; displayName: string; avatarUrl: string | null }

type Props = {
  channel: FollowChannel | null | undefined
  /** What the page already knows about the viewer's follow (skips a request). */
  seed?: FollowCacheValue | null
  /** The page knows the viewer owns the channel (`viewer.isOwner`). */
  owner?: boolean
  /** 32 px variant for cards and lists. */
  size?: 'default' | 'sm'
  /** Full-width on phones (profile header). */
  block?: boolean
  className?: string
}

function BellGlyph({ level, className }: { level: NotifyLevel | null; className?: string }) {
  const kind = bellKind(level)
  const Icon = kind === 'off' ? BellOffIcon : kind === 'plain' ? BellIcon : BellRingIcon

  return <Icon className={className} aria-hidden />
}

function LevelOption({ level, current, onSelect, sheet }: { level: NotifyLevel; current: NotifyLevel | null; onSelect: () => void; sheet?: boolean }) {
  const { t } = useTranslation('channel')
  const body = (
    <>
      <BellGlyph level={level} className="mt-0.5 size-4.5 shrink-0" />
      <span className="flex flex-1 flex-col gap-0.5 text-left">
        <span className="text-body-md font-medium text-foreground">{t(`follow.levels.${level}`)}</span>
        {level === 'ALL' && <span className="text-label-sm font-normal text-muted-foreground">{t('follow.levelAllDesc')}</span>}
      </span>
      {current === level && <CheckIcon className="size-4.5 shrink-0 text-primary" aria-hidden />}
    </>
  )
  if (sheet) {
    return (
      <button type="button" role="menuitemradio" aria-checked={current === level} onClick={onSelect} className="flex min-h-11 w-full items-start gap-2.5 rounded-control p-2.5 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
        {body}
      </button>
    )
  }

  return (
    <DropdownMenuItem role="menuitemradio" aria-checked={current === level} onSelect={onSelect} className={cn('items-start gap-2.5 p-2.5', current === level && 'bg-accent')}>
      {body}
    </DropdownMenuItem>
  )
}

/**
 * Button/Follow + Menu/Bell (Components GĐ4, NXL-D §3.7). Guests get the login modal with the follow remembered;
 * the owner sees "Chỉnh sửa kênh". Follow / bell / unfollow change at once and roll back on failure.
 */
export function FollowButton({ channel, seed, owner, size = 'default', block = false, className }: Props) {
  const { t } = useTranslation('channel')
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const own = useAuthStore((s) => Boolean(channel && s.me?.channelId === channel.id)) || owner === true
  const gated = useGatedAction()
  const desktop = useMediaQuery(MEDIA.md)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const target = { id: channel?.id ?? '', handle: channel?.handle ?? '' }
  const state = useFollow(target, signedIn ? seed : null)
  const sm = size === 'sm'

  if (!channel) return null
  const name = channelName(channel) ?? t('follow.thisChannel')

  if (own) {
    return (
      <Button asChild variant="secondary" size={sm ? 'sm' : 'default'} className={cn('max-md:h-11', block && 'max-md:w-full', className)}>
        <Link to="/studio/channel" data-testid="edit-channel">
          <PencilIcon />
          {t('follow.editChannel')}
        </Link>
      </Button>
    )
  }

  if (!signedIn || !state.following) {
    return (
      <Button
        size={sm ? 'sm' : 'default'}
        className={cn(!sm && 'min-w-31 max-md:h-11', block && 'max-md:w-full', className)}
        loading={state.busy}
        onClick={() => (signedIn ? state.follow() : gated({ type: 'follow', params: { channelId: channel.id, channelName: name }, context: 'follow' }))}
        data-testid="follow-button"
      >
        {!state.busy && <HeartIcon />}
        {t('follow.follow')}
      </Button>
    )
  }

  const select = (level: NotifyLevel) => {
    setMenuOpen(false)
    state.setLevel(level)
  }
  const askUnfollow = () => {
    setMenuOpen(false)
    setConfirm(true)
  }
  const levelLabel = t(`follow.levels.${state.notifyLevel ?? 'ALL'}`)
  const bellButton = (
    <Button
      variant="secondary"
      size={sm ? 'icon-sm' : 'icon'}
      className={cn(!sm && 'max-md:size-11')}
      aria-label={t('follow.bellLabel', { level: levelLabel })}
      aria-haspopup="menu"
      data-testid="follow-bell"
      onClick={desktop ? undefined : () => setMenuOpen(true)}
    >
      <BellGlyph level={state.notifyLevel} className={sm ? 'size-4' : 'size-5'} />
    </Button>
  )

  return (
    <div className={cn('flex items-center', sm ? 'gap-1' : 'gap-1.5', block && 'max-md:w-full', className)} data-testid="follow-state">
      <Button
        variant="secondary"
        size={sm ? 'sm' : 'default'}
        className={cn(!sm && 'max-md:h-11', block && 'max-md:flex-1')}
        loading={state.busy}
        onClick={() => setConfirm(true)}
        data-testid="follow-button"
      >
        {!state.busy && <CheckIcon />}
        {t('follow.following')}
      </Button>

      {desktop ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>{bellButton}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 bg-surface p-1.5">
            <DropdownMenuLabel className="px-2.5 pt-2 pb-1 text-label-sm font-medium text-muted-foreground">{t('follow.bellTitle')}</DropdownMenuLabel>
            {NOTIFY_LEVELS.map((l) => (
              <LevelOption key={l} level={l} current={state.notifyLevel} onSelect={() => select(l)} />
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={askUnfollow} className="p-2.5 font-medium text-destructive focus:text-destructive">
              {t('follow.unfollow')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          {bellButton}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetContent side="bottom" className="gap-1 rounded-t-xl bg-surface p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <SheetHeader className="p-2">
                <SheetTitle className="text-label-md text-muted-foreground">{t('follow.bellTitle')}</SheetTitle>
              </SheetHeader>
              <div role="menu" aria-label={t('follow.bellTitle')} className="flex flex-col">
                {NOTIFY_LEVELS.map((l) => (
                  <LevelOption key={l} level={l} current={state.notifyLevel} onSelect={() => select(l)} sheet />
                ))}
                <div className="my-1 h-px bg-border" />
                <button type="button" role="menuitem" onClick={askUnfollow} className="min-h-11 rounded-control p-2.5 text-left text-body-md font-medium text-destructive hover:bg-accent">
                  {t('follow.unfollow')}
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      <ConfirmDialog
        open={confirm}
        title={t('follow.unfollowTitle', { name })}
        confirmLabel={t('follow.unfollow')}
        danger
        onConfirm={() => {
          setConfirm(false)
          state.unfollow()
        }}
        onClose={() => setConfirm(false)}
      >
        {t('follow.unfollowBody')}
      </ConfirmDialog>
    </div>
  )
}
