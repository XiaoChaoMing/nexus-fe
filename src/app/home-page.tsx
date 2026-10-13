import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { CreatorCta } from '@/features/creator/components/creator-cta'
import { LiveGrid } from '@/features/home/live-grid'

export function HomePage() {
  const { t } = useTranslation(['home', 'common'])
  const user = useAuthStore((s) => s.user)

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-6">
        <h1 className="text-[22px] font-semibold text-fg">{user ? t('greeting', { name: user.displayName }) : t('common:brand')}</h1>
      </div>
      <LiveGrid />
      {/* NXL-C BR02: the Creator CTA closes the home page. */}
      <CreatorCta />
    </div>
  )
}
