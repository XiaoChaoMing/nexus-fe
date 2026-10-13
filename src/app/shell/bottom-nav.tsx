import type { MouseEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useBottomNavHidden } from '@/hooks/use-bottom-nav-hidden'
import { cn } from '@/lib/utils'
import { BOTTOM_NAV, type NavItem } from './nav-items'

function isActive(item: NavItem, pathname: string) {
  return item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`)
}

/** Mobile (<768px) navigation, NXL-C BR33 / AF12: five 56 px targets, hidden in fullscreen or while typing. */
export function BottomNav() {
  const { t } = useTranslation()
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const hidden = useBottomNavHidden()
  const gated = useGatedAction()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const onClick = (item: NavItem) => (e: MouseEvent) => {
    if (isActive(item, location.pathname)) {
      // AF12: tapping the current tab scrolls to the top, or refreshes when already there.
      e.preventDefault()
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' })
      else void queryClient.invalidateQueries({ queryKey: ['streams'] })

      return
    }
    if (!item.gated || signedIn) return
    e.preventDefault()
    // Profile has no guest page: only the modal. Following shows its intro page underneath (AF03).
    if (item.to === '/following') navigate(item.to)
    gated({ type: 'navigate', params: { to: item.to }, returnTo: item.to })
  }

  return (
    <nav
      aria-label={t('nav.mobile')}
      data-testid="bottom-nav"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t bg-surface px-0 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] md:hidden',
        hidden && 'hidden',
      )}
    >
      {BOTTOM_NAV.map((item) => {
        const Icon = item.icon

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClick(item)}
            className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] leading-4 font-medium text-muted-foreground aria-[current=page]:font-semibold aria-[current=page]:text-primary"
          >
            <Icon className="size-6" aria-hidden />
            {t(item.label)}
          </NavLink>
        )
      })}
    </nav>
  )
}
