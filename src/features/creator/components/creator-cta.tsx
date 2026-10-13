import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SparklesIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { isCreator } from '@/features/auth/lib/roles'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { dismissCta, isCtaDismissed } from '@/features/creator/lib/cta-dismiss'

/** NXL-C BR36: thin banner for guests and viewers who are not creators; no revenue-share promises. */
export function CreatorCta() {
  const { t } = useTranslation('creator')
  const creator = useAuthStore((s) => isCreator(s.me))
  const [hidden, setHidden] = useState(isCtaDismissed)
  const gated = useGatedAction()

  if (creator || hidden) return null

  return (
    <aside className="mx-4 my-6 flex flex-wrap items-center gap-4 rounded-xl border bg-surface p-4 md:p-5" aria-labelledby="creator-cta-title" data-testid="creator-cta">
      <span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary" aria-hidden>
        <SparklesIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="creator-cta-title" className="font-heading text-headline-sm">
          {t('cta.title')}
        </h2>
        <p className="text-body-sm text-muted-foreground">{t('cta.body')}</p>
      </div>
      <Button onClick={() => gated({ type: 'becomeCreator', tab: 'register' })}>{t('cta.action')}</Button>
      <Button
        variant="ghost"
        size="icon-sm"
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
