import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SparklesIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { isCreator } from '@/features/auth/lib/roles'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { dismissCta, isCtaDismissed } from '@/features/creator/lib/cta-dismiss'

/**
 * NXL-C BR36 Creator CTA (01 · Trang chủ): closes the home page for guests and viewers who are not creators;
 * no revenue-share promises. Dismissable for 30 days (AF11).
 */
export function CreatorCta() {
  const { t } = useTranslation('creator')
  const creator = useAuthStore((s) => isCreator(s.me))
  const [hidden, setHidden] = useState(isCtaDismissed)
  const gated = useGatedAction()

  if (creator || hidden) return null

  return (
    <aside
      className="relative flex flex-col gap-3 overflow-hidden rounded-panel border bg-surface bg-linear-to-l from-primary/0 from-40% to-primary/10 p-5 md:gap-5 md:p-6 xl:flex-row xl:items-center xl:justify-between xl:gap-6 xl:px-8 xl:py-7"
      aria-labelledby="creator-cta-title"
      data-testid="creator-cta"
    >
      <div className="flex flex-col gap-1.5 pr-8 xl:pr-0">
        <h2 id="creator-cta-title" className="font-heading text-lg leading-6 font-bold text-foreground md:text-[22px] md:leading-7 md:tracking-[-0.4px]">
          {t('cta.title')}
        </h2>
        <p className="text-body-md text-muted-foreground">{t('cta.body')}</p>
      </div>
      <div className="flex flex-col gap-2 pt-1 md:flex-row md:gap-2.5 md:pt-0 xl:shrink-0 xl:pr-6">
        <Button className="h-12 md:h-11 md:px-5.5" onClick={() => gated({ type: 'becomeCreator', tab: 'register' })}>
          <SparklesIcon />
          {t('cta.action')}
        </Button>
        <Button variant="secondary" className="h-12 font-medium md:h-11 md:px-5" onClick={() => gated({ type: 'becomeCreator', tab: 'login' })}>
          {t('cta.learnMore')}
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2 max-md:size-11"
        aria-label={t('cta.dismiss')}
        onClick={() => {
          dismissCta()
          setHidden(true)
        }}
      >
        <XIcon />
      </Button>
    </aside>
  )
}
