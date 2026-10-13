import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CompassIcon, HeartIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { savePendingAction } from '@/features/auth/lib/pending-action'
import { useAuthModal } from '@/features/auth/stores/auth-modal-store'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { LiveGrid } from '@/features/home/live-grid'

/** /browse — GĐ1 lists the live channels; categories and filters come with discovery (GĐ2). */
export function BrowsePage() {
  const { t } = useTranslation('home')

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-4 xl:p-6">
      <h1 className="font-heading text-headline-lg">{t('browse.title')}</h1>
      <LiveGrid heading={t('browse.live')} />
    </div>
  )
}

/** /following — guest intro with sign-in (NXL-C AF03), empty state until follows exist (GĐ4). */
export function FollowingPage() {
  const { t } = useTranslation('home')
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const show = useAuthModal((s) => s.show)

  const open = (tab: 'login' | 'register') => {
    savePendingAction({ type: 'navigate', params: { to: '/following' }, returnTo: '/following' })
    show(tab)
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <h1 className="font-heading text-headline-lg">{t('following.title')}</h1>
      <Empty className="mt-6 border" data-testid={signedIn ? 'following-empty' : 'following-intro'}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HeartIcon />
          </EmptyMedia>
          <EmptyTitle>{signedIn ? t('following.emptyTitle') : t('following.guestTitle')}</EmptyTitle>
          <EmptyDescription>{signedIn ? t('following.emptyBody') : t('following.guestBody')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            {!signedIn && (
              <>
                <Button onClick={() => open('login')}>{t('following.login')}</Button>
                <Button variant="secondary" onClick={() => open('register')}>
                  {t('following.register')}
                </Button>
              </>
            )}
            <Button asChild variant={signedIn ? 'default' : 'ghost'}>
              <Link to="/browse">
                <CompassIcon />
                {t('following.discover')}
              </Link>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  )
}

/** /search — mobile tab target; search ships with discovery (GĐ2). */
export function SearchPage() {
  const { t } = useTranslation('home')

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <h1 className="font-heading text-headline-lg">{t('search.title')}</h1>
      <Empty className="mt-6 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchIcon />
          </EmptyMedia>
          <EmptyTitle>{t('search.soonTitle')}</EmptyTitle>
          <EmptyDescription>{t('search.soonBody')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/browse">
              <CompassIcon />
              {t('following.discover')}
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
