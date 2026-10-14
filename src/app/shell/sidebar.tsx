import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useNavigate } from 'react-router'
import { HeartIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react'
import { useSidebarToggle } from '@/app/shell/use-sidebar-toggle'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { useAuthModal } from '@/features/auth/stores/auth-modal-store'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { useCategoryMap } from '@/features/categories/api'
import { useSidebarFollowing } from '@/features/channels/hooks/use-following'
import { channelName } from '@/features/channels/lib/channel-display'
import { profilePath } from '@/features/channels/lib/handle'
import { useRecommendedStreams } from '@/features/streams/hooks/use-streams'
import { compactCount } from '@/lib/format'
import { useUiStore } from '@/stores/ui-store'
import { MAIN_NAV, SETTINGS_NAV, type NavItem } from './nav-items'
import { SIDEBAR_CHANNELS_MAX, suggestedChannels } from './suggested-channels'

function WithTooltip({ collapsed, label, children }: { collapsed: boolean; label: string; children: ReactElement }) {
  if (!collapsed) return children

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { t } = useTranslation()
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const gated = useGatedAction()
  const navigate = useNavigate()
  const Icon = item.icon
  const label = t(item.label)

  return (
    <WithTooltip collapsed={collapsed} label={label}>
      <NavLink
        to={item.to}
        end={item.to === '/'}
        aria-label={collapsed ? label : undefined}
        onClick={(e) => {
          if (!item.gated || signedIn) return
          // AF03: the guest still sees the intro page, with the login modal on top.
          e.preventDefault()
          navigate(item.to)
          gated({ type: 'navigate', params: { to: item.to }, returnTo: item.to })
        }}
        // Static class with aria-current styling: Radix Slot (tooltip trigger) cannot merge a className function.
        className={cn(
          'flex h-10 items-center gap-3 rounded-lg px-3 text-label-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          'aria-[current=page]:bg-card aria-[current=page]:font-semibold aria-[current=page]:text-foreground',
          collapsed && 'mx-auto h-11 w-12 justify-center px-0',
        )}
      >
        <Icon className={cn('shrink-0', collapsed ? 'size-5.5' : 'size-5')} aria-hidden />
        {!collapsed && <span className="truncate">{label}</span>}
      </NavLink>
    </WithTooltip>
  )
}

function GroupLabel({ id, collapsed, children }: { id: string; collapsed: boolean; children: string }) {
  if (collapsed) {
    return (
      <span id={id} className="sr-only">
        {children}
      </span>
    )
  }

  return (
    <h2 id={id} className="px-2 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.8px] text-subtle-foreground uppercase">
      {children}
    </h2>
  )
}

type ChannelItemProps = {
  to: string
  channel: { id: string; handle: string; displayName: string; avatarUrl: string | null }
  live: boolean
  /** Category name, or "Ngoại tuyến". */
  line: string | null
  viewers: number | null
  collapsed: boolean
  tooltip: string
}

/** Sidebar/Channel Item: live (avatar + red dot, category, viewers), offline (dimmed), collapsed (avatar + tooltip). */
function ChannelItem({ to, channel, live, line, viewers, collapsed, tooltip }: ChannelItemProps) {
  const name = channelName(channel) ?? channel.handle

  return (
    <li>
      <WithTooltip collapsed={collapsed} label={tooltip}>
        <Link
          to={to}
          aria-label={collapsed ? tooltip : undefined}
          className={cn('flex items-center gap-2.5 rounded-lg p-2 hover:bg-accent', collapsed && 'mx-auto h-11 w-12 justify-center p-0')}
          data-testid={live ? 'sidebar-channel-live' : 'sidebar-channel-offline'}
          data-channel={channel.handle}
        >
          <span className={cn(!live && 'opacity-50')}>
            <ChannelAvatar channel={channel} liveDot={live} />
          </span>
          {!collapsed && (
            <>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className={cn('truncate text-label-md', live ? 'text-foreground' : 'text-muted-foreground')}>{name}</span>
                {line && <span className={cn('truncate text-label-sm font-normal', live ? 'text-subtle-foreground' : 'text-muted-foreground')}>{line}</span>}
              </span>
              {live && viewers !== null && (
                <span className="flex shrink-0 items-center gap-1 text-label-sm font-medium text-live tabular-nums">
                  <span className="size-1.5 rounded-full bg-live" aria-hidden />
                  {compactCount(viewers)}
                </span>
              )}
            </>
          )}
        </Link>
      </WithTooltip>
    </li>
  )
}

function SidebarSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <ul className="flex flex-col gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className={cn('flex items-center gap-2.5 p-2', collapsed && 'justify-center')}>
          <Skeleton className="size-8 shrink-0 rounded-full" />
          {!collapsed && (
            <span className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-2.5 w-28 rounded-sm" />
              <Skeleton className="h-2 w-18 rounded-sm" />
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Channels shown before "Xem thêm" (up to SIDEBAR_CHANNELS_MAX after it). */
const SIDEBAR_FIRST = 5

/** "Kênh đang theo dõi" (14 · Sidebar): live first by viewers, then offline; realtime through `sidebar:{userId}`. */
function FollowedChannels({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation(['discover', 'common'])
  const { data, isPending } = useSidebarFollowing()
  const categories = useCategoryMap()
  const [expanded, setExpanded] = useState(false)

  if (isPending && !data) return <SidebarSkeleton collapsed={collapsed} />
  const entries = data?.entries ?? []
  if (entries.length === 0) {
    return collapsed ? null : (
      <p className="px-2 text-body-sm text-subtle-foreground" data-testid="sidebar-following-empty">
        {t('discover:sidebar.empty')}
      </p>
    )
  }
  const shown = entries.slice(0, expanded ? SIDEBAR_CHANNELS_MAX : SIDEBAR_FIRST)

  return (
    <>
      <ul className="flex flex-col gap-0.5" data-testid="sidebar-following">
        {shown.map((e) => {
          const name = channelName(e.channel) ?? e.channel.handle
          const category = e.stream?.categoryId ? (categories.get(e.stream.categoryId)?.name ?? null) : null
          const viewers = e.stream?.viewerCount ?? null
          const tooltip = e.stream
            ? category
              ? t('discover:sidebar.liveTooltip', { name, category, viewers: viewers === null ? '' : compactCount(viewers) })
              : t('discover:sidebar.liveTooltipNoCategory', { name, viewers: viewers === null ? '' : compactCount(viewers) })
            : t('discover:sidebar.offlineTooltip', { name })

          return (
            <ChannelItem
              key={e.channel.id}
              to={e.stream ? `/live/${e.stream.id}` : profilePath(e.channel.handle)}
              channel={e.channel}
              live={Boolean(e.stream)}
              line={e.stream ? category : t('discover:sidebar.offline')}
              viewers={viewers}
              collapsed={collapsed}
              tooltip={tooltip}
            />
          )
        })}
      </ul>
      {!collapsed && entries.length > SIDEBAR_FIRST && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 rounded-control px-2 py-1 text-left text-label-sm text-muted-foreground hover:text-foreground">
          {expanded ? t('discover:sidebar.showLess') : t('discover:sidebar.showMore')}
        </button>
      )}
    </>
  )
}

/** Guests: "Kênh đề xuất" from the live recommendations (no 18+). */
function SuggestedChannels({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation()
  const { data } = useRecommendedStreams(SIDEBAR_CHANNELS_MAX)
  const categories = useCategoryMap()
  const items = suggestedChannels(data)

  if (items.length === 0) {
    return collapsed ? null : <p className="px-2 text-body-sm text-subtle-foreground">{t('sidebar.noSuggestions')}</p>
  }

  return (
    <ul className="flex flex-col gap-0.5" data-testid="suggested-channels">
      {items.map((s) => {
        const name = channelName(s.channel) ?? s.title
        const category = categories.get(s.category?.id ?? '')?.name ?? null

        return (
          <ChannelItem
            key={s.id}
            to={`/live/${s.id}`}
            channel={s.channel ?? { id: s.id, handle: '', displayName: s.title, avatarUrl: null }}
            live
            line={category ?? (s.channel ? s.title : null)}
            viewers={s.viewerCount ?? null}
            collapsed={collapsed}
            tooltip={name}
          />
        )
      })}
    </ul>
  )
}

/** Login Prompt (01 · Trang chủ — Khách): replaces the channel lists for guests. */
function GuestInvite() {
  const { t } = useTranslation()
  const show = useAuthModal((s) => s.show)

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-card px-3 py-4" data-testid="sidebar-login-invite">
      <HeartIcon className="size-5.5 text-primary" aria-hidden />
      <p className="text-label-md text-foreground">{t('sidebar.loginInvite')}</p>
      <Button onClick={() => show('login')}>{t('auth.login')}</Button>
    </div>
  )
}

/** Sidebar (240 px) or icon rail (64 px); the rail is forced while a player is in theater mode. */
export function Sidebar() {
  const { t } = useTranslation()
  const { collapsed: savedCollapsed, toggle } = useSidebarToggle()
  const theater = useUiStore((s) => s.theater)
  const collapsed = savedCollapsed || theater
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const toggleLabel = collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')

  return (
    <aside
      aria-label={t('nav.main')}
      className={cn(
        'sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col justify-between overflow-y-auto border-r bg-surface transition-[width] md:flex',
        collapsed ? 'w-16 px-2 py-3' : 'w-60 px-3 py-4',
      )}
    >
      <div className={cn('flex flex-col', collapsed ? 'gap-1' : 'gap-0.5')}>
        <nav className={cn('flex flex-col', collapsed ? 'gap-1' : 'gap-0.5')}>
          {MAIN_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <div className={cn('my-2 h-px bg-border', collapsed && 'mx-auto w-8')} />

        {signedIn ? (
          <section aria-labelledby="sidebar-following">
            <GroupLabel id="sidebar-following" collapsed={collapsed}>
              {t('sidebar.following')}
            </GroupLabel>
            <FollowedChannels collapsed={collapsed} />
          </section>
        ) : (
          <>
            <section aria-labelledby="sidebar-suggested">
              <GroupLabel id="sidebar-suggested" collapsed={collapsed}>
                {t('sidebar.suggested')}
              </GroupLabel>
              <SuggestedChannels collapsed={collapsed} />
            </section>
            {!collapsed && <GuestInvite />}
          </>
        )}
      </div>

      <div className={cn('flex items-center gap-1 pt-3', collapsed && 'flex-col')}>
        {signedIn && (
          <div className="min-w-0 flex-1">
            <SidebarLink item={SETTINGS_NAV} collapsed={collapsed} />
          </div>
        )}
        {!theater && (
          <WithTooltip collapsed={collapsed} label={toggleLabel}>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              className={cn(collapsed ? 'h-11 w-12' : 'ml-auto')}
            >
              {collapsed ? <PanelLeftOpenIcon className="size-5.5" /> : <PanelLeftCloseIcon className="size-5" />}
            </Button>
          </WithTooltip>
        )}
      </div>
    </aside>
  )
}
