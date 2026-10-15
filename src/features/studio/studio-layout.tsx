import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { CalendarDaysIcon, ExternalLinkIcon, FilmIcon, LayoutDashboardIcon, RadioIcon, TriangleAlertIcon, UserRoundCogIcon, UsersIcon, type LucideIcon } from 'lucide-react'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { profilePath } from '@/features/channels/lib/handle'
import { useStudioChannel } from '@/features/studio/hooks/use-studio-data'
import { cn } from '@/lib/utils'

type Item = { to: string; label: 'nav.dashboard' | 'nav.stream' | 'nav.content' | 'nav.schedule' | 'nav.channel' | 'nav.community'; icon: LucideIcon }

const ITEMS: Item[] = [
  { to: '/studio', label: 'nav.dashboard', icon: LayoutDashboardIcon },
  { to: '/studio/stream', label: 'nav.stream', icon: RadioIcon },
  { to: '/studio/content', label: 'nav.content', icon: FilmIcon },
  { to: '/studio/schedule', label: 'nav.schedule', icon: CalendarDaysIcon },
  { to: '/studio/channel', label: 'nav.channel', icon: UserRoundCogIcon },
  { to: '/studio/community', label: 'nav.community', icon: UsersIcon },
]

/**
 * Studio frame (S0 · Studio/Nav): a 240 px column with the channel and "Xem kênh ↗" on desktop, a horizontal tab
 * strip under the header on smaller screens. Each page handles NOT_CREATOR itself.
 */
export function StudioLayout() {
  const { t } = useTranslation(['studio', 'moderation'])
  const channel = useStudioChannel()
  const { pathname } = useLocation()
  const c = channel.data

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col lg:flex-row">
      <aside className="shrink-0 border-b bg-surface lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-60 lg:border-r lg:border-b-0" aria-label={t('nav.label')}>
        {c && (
          <div className="hidden flex-col gap-2 border-b p-4 lg:flex">
            <div className="flex min-w-0 items-center gap-2.5">
              <ChannelAvatar channel={c} size="lg" />
              <span className="truncate text-label-md font-semibold text-foreground">{c.displayName || c.handle}</span>
            </div>
            <Link to={profilePath(c.handle)} className="inline-flex w-fit items-center gap-1 text-label-sm text-primary hover:underline">
              {t('nav.viewChannel')}
              <ExternalLinkIcon className="size-3.5" aria-hidden />
            </Link>
          </div>
        )}
        <nav className="flex gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:px-3 lg:py-4">
          {ITEMS.map((item) => {
            const Icon = item.icon
            const active = item.to === '/studio' ? pathname === '/studio' : pathname.startsWith(item.to)

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/studio'}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-label-md whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-lg:h-11',
                  active && 'bg-card font-semibold text-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {t(item.label)}
              </NavLink>
            )
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        {c?.status === 'SUSPENDED' && (
          <div className="mx-4 mt-4 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/15 px-4 py-3 md:mx-10" role="status" data-testid="studio-suspended">
            <TriangleAlertIcon className="mt-px size-5 shrink-0 text-warning" aria-hidden />
            <p className="text-body-md text-foreground">{t('moderation:community.suspendedBanner')}</p>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  )
}

/** Breadcrumb "Studio › {page}" + page title + optional actions (S1–S4 headers). */
export function StudioPageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  const { t } = useTranslation(['studio', 'common'])

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <nav aria-label={t('common:nav.breadcrumb')} className="flex items-center gap-1.5 text-label-sm font-semibold uppercase">
          <span className="text-subtle-foreground">{t('studio:breadcrumb.studio')}</span>
          <span className="text-subtle-foreground" aria-hidden>
            ›
          </span>
          <span className="text-primary">{title}</span>
        </nav>
        <h1 className="font-heading text-[28px] leading-tight font-bold">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}
