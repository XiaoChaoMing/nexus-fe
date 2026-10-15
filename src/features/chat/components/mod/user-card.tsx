import { useRef, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BanIcon, CalendarIcon, ClockIcon, FlagIcon, HeartIcon, RotateCwIcon, ShieldCheckIcon, ShieldOffIcon, ShieldPlusIcon, SparklesIcon, XIcon } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatBadgeIcon } from '@/features/chat/components/chat-badge'
import { anchorOf, useChatMod, type Anchor } from '@/features/chat/components/mod/context'
import type { ModTarget } from '@/features/chat/hooks/use-chat-moderation'
import { usernameColor, visibleBadges } from '@/features/chat/lib/appearance'
import { modApi } from '@/features/moderation/api'
import { TIMEOUT_PRESETS, timeLeft } from '@/features/moderation/lib/duration'
import { cardActions, type CardAction } from '@/features/moderation/lib/permissions'
import type { UserCard } from '@/features/moderation/types'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

type CardUser = ModTarget & { displayName: string }

function useLeftText() {
  const { t } = useTranslation('moderation')

  return (until: string | null, now: number) => {
    const left = timeLeft(until, now)
    if (!left) return ''

    return 'clock' in left ? left.clock : t('duration.day', { count: left.days })
  }
}

function CardButton({ children, onClick, danger, icon, testId }: { children: ReactNode; onClick: (el: HTMLButtonElement) => void; danger?: boolean; icon?: ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => onClick(e.currentTarget)}
      data-testid={testId}
      className={cn(
        'inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border px-2 text-[13px] font-medium whitespace-nowrap outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring max-md:h-11 [&_svg]:size-4.5',
        danger ? 'bg-surface text-destructive' : 'bg-card text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function TextButton({ children, onClick, testId }: { children: ReactNode; onClick: () => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="rounded-lg px-0.5 py-1.5 text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-md:min-h-11"
    >
      {children}
    </button>
  )
}

/** "Timeout ▸": the presets, then "Tùy chỉnh…" (Menu/Timeout). */
function TimeoutMenu({ user }: { user: CardUser }) {
  const { t } = useTranslation('moderation')
  const { mod, customTimeout } = useChatMod()
  const trigger = useRef<HTMLButtonElement>(null)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          ref={trigger}
          type="button"
          data-testid="card-timeout"
          className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border bg-card px-2 text-[13px] font-medium whitespace-nowrap text-foreground outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring max-md:h-11"
        >
          {t('card.timeout')}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-45">
        {TIMEOUT_PRESETS.map((p) => (
          <DropdownMenuItem key={p.sec} onSelect={() => void mod.timeout(user, p.sec)}>
            {t(p.label)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => trigger.current && customTimeout(user, anchorOf(trigger.current))}>{t('timeout.custom')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CardBody({ user, card, onClose }: { user: CardUser; card: UserCard; onClose: () => void }) {
  const { t } = useTranslation('moderation')
  const ctx = useChatMod()
  const now = useNow(card.restriction?.type === 'TIMEOUT' ? 1000 : 60_000)
  const left = useLeftText()
  const self = ctx.myId === card.user.id
  const target = { id: card.user.id, username: card.user.username || user.username }
  const actions = cardActions({
    card,
    canModerate: ctx.canModerate,
    myRole: ctx.myRole,
    isSelf: self,
    blocked: ctx.blocked.has(card.user.id),
    muted: ctx.muted.has(card.user.id),
    now,
  })
  const timedOut = card.restriction?.type === 'TIMEOUT' && (!card.restriction.until || Date.parse(card.restriction.until) > now)
  const run = (a: CardAction, el?: HTMLElement) => {
    switch (a) {
      case 'timeout':
        return
      case 'ban':
        onClose()
        ctx.askBan(target)

        return
      case 'untimeout':
        void ctx.mod.untimeout(target)

        return
      case 'unban':
        void ctx.mod.unban(target)

        return
      case 'report':
        onClose()
        ctx.report({ type: 'USER', id: target.id, username: target.username, displayName: card.user.displayName, streamId: ctx.streamId })

        return
      case 'block':
        onClose()
        ctx.askBlock(target)

        return
      case 'unblock':
        ctx.unblock(target)

        return
      case 'mute':
      case 'unmute':
        ctx.toggleMute(target)

        return
      case 'makeMod':
        void ctx.mod.setRole(target, 'MODERATOR')

        return
      case 'makeVip':
        void ctx.mod.setRole(target, 'VIP')

        return
      case 'removeMod':
        void ctx.mod.removeRole(target, 'MODERATOR')

        return
      case 'removeVip':
        void ctx.mod.removeRole(target, 'VIP')
        if (el) el.blur()
    }
  }
  const label: Record<CardAction, string> = {
    timeout: t('card.timeout'),
    ban: t('card.ban'),
    untimeout: t('card.untimeout'),
    unban: t('card.unban'),
    report: t('card.report'),
    block: t('card.block'),
    unblock: t('card.unblock'),
    mute: actions.primary.includes('untimeout') || actions.primary.includes('unban') ? t('card.muteShort') : t('card.mute'),
    unmute: t('card.unmute'),
    makeMod: t('card.makeMod'),
    makeVip: t('card.makeVip'),
    removeMod: t('card.removeMod'),
    removeVip: t('card.removeVip'),
  }
  const icon: Partial<Record<CardAction, ReactNode>> = {
    untimeout: <ClockIcon aria-hidden />,
    makeMod: <ShieldPlusIcon aria-hidden />,
    makeVip: <SparklesIcon aria-hidden />,
    removeMod: <ShieldOffIcon aria-hidden />,
    removeVip: <ShieldOffIcon aria-hidden />,
    unban: <ShieldCheckIcon aria-hidden />,
    report: actions.primary.length === 1 ? <FlagIcon aria-hidden /> : undefined,
  }
  const button = (a: CardAction) =>
    a === 'timeout' ? (
      <TimeoutMenu key={a} user={{ ...target, displayName: card.user.displayName }} />
    ) : (
      <CardButton key={a} danger={a === 'ban'} icon={a === 'ban' && timedOut ? <BanIcon aria-hidden /> : icon[a]} onClick={(el) => run(a, el)} testId={`card-${a}`}>
        {label[a]}
      </CardButton>
    )

  return (
    <div className="flex flex-col gap-3.5" data-testid="user-card">
      <div className="flex items-start gap-3">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-avatar text-[22px] font-semibold" style={{ color: usernameColor(card.user.id) }} aria-hidden>
          {(card.user.displayName || card.user.username).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.75 pt-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-base font-bold text-foreground">{card.user.displayName}</span>
            {visibleBadges(card.badges).map((b) => (
              <ChatBadgeIcon key={b} badge={b} />
            ))}
          </span>
          <span className="truncate text-[13px] text-muted-foreground">@{card.user.username}</span>
        </div>
      </div>
      {(card.createdAt || card.followedAt) && (
        <div className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
          {card.createdAt && (
            <span className="flex items-center gap-2">
              <CalendarIcon className="size-4" aria-hidden />
              {t('card.created', { date: formatDate(card.createdAt, { month: '2-digit', year: 'numeric' }) })}
            </span>
          )}
          {card.followedAt && (
            <span className="flex items-center gap-2">
              <HeartIcon className="size-4" aria-hidden />
              {t('card.following', { date: formatDate(card.followedAt, { day: '2-digit', month: '2-digit', year: 'numeric' }) })}
            </span>
          )}
        </div>
      )}
      {ctx.canModerate && card.restriction && (card.restriction.type === 'BAN' || timedOut) && (
        <div>
          {card.restriction.type === 'BAN' ? (
            <span className="inline-flex rounded-control bg-destructive px-2 py-0.75 text-label-sm font-semibold text-primary-foreground" data-testid="card-restriction">
              {t('card.banBadge')}
            </span>
          ) : (
            <span className="inline-flex rounded-control bg-warning/15 px-2 py-0.75 text-label-sm font-semibold text-warning tabular-nums" data-testid="card-restriction">
              {t('card.timeoutBadge', { left: left(card.restriction.until, now) })}
            </span>
          )}
        </div>
      )}
      {(actions.primary.length > 0 || actions.roles.length > 0 || actions.secondary.length > 0) && (
        <div className="flex flex-col gap-2">
          {actions.primary.length > 0 && <div className="flex gap-2">{actions.primary.map(button)}</div>}
          {actions.roles.length > 0 && <div className="flex gap-2">{actions.roles.map(button)}</div>}
          {actions.secondary.length > 0 && (
            <div className="flex flex-wrap gap-x-5">
              {actions.secondary.map((a) => (
                <TextButton key={a} onClick={() => run(a)} testId={`card-${a}`}>
                  {label[a]}
                </TextButton>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CardState({ user, onClose }: { user: CardUser; onClose: () => void }) {
  const { t } = useTranslation('moderation')
  const { channelId } = useChatMod()
  const query = useQuery({ queryKey: ['chat-card', channelId, user.id], queryFn: () => modApi.card(channelId, user.id), staleTime: 0 })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClose}
        aria-label={t('card.close')}
        className="absolute -top-1 -right-1 z-10 grid size-7 place-items-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-md:size-11"
      >
        <XIcon className="size-4.5" aria-hidden />
      </button>
      {query.isPending ? (
        <div className="flex flex-col gap-3.5" aria-busy aria-label={t('card.loading')}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-16 rounded-full bg-card" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-32 rounded-sm bg-card" />
              <Skeleton className="h-3 w-20 rounded-sm bg-card" />
            </div>
          </div>
          <Skeleton className="h-3 w-40 rounded-sm bg-card" />
          <Skeleton className="h-9 w-full rounded-lg bg-card" />
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="alert">
          <p className="text-body-md text-foreground">{t('card.loadFailed')}</p>
          <button type="button" onClick={() => void query.refetch()} className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-label-md font-semibold text-primary hover:bg-accent">
            <RotateCwIcon className="size-4" aria-hidden />
            {t('card.retry')}
          </button>
        </div>
      ) : (
        <CardBody user={user} card={query.data} onClose={onClose} />
      )}
    </div>
  )
}

/** Chat/User Card: a 320 px popover next to the name (desktop) or a bottom sheet (mobile). */
export function UserCardLayer({ user, anchor, onClose }: { user: CardUser; anchor: Anchor; onClose: () => void }) {
  const { t } = useTranslation('moderation')
  const desktop = useMediaQuery(MEDIA.md)

  if (!desktop) {
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" showCloseButton={false} className="rounded-t-xl px-4 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <SheetTitle className="sr-only">{t('card.title')}</SheetTitle>
          <SheetDescription className="sr-only">@{user.username}</SheetDescription>
          <CardState user={user} onClose={onClose} />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open onOpenChange={(o) => !o && onClose()}>
      <PopoverAnchor virtualRef={{ current: anchor }} />
      <PopoverContent side="left" align="start" sideOffset={12} collisionPadding={16} className="w-80 rounded-xl bg-surface p-4" aria-label={t('card.title')}>
        <CardState user={user} onClose={onClose} />
      </PopoverContent>
    </Popover>
  )
}
