import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Loader2Icon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isCreator } from '@/features/auth/lib/roles'
import { loadMe } from '@/features/auth/lib/session'
import { useAuthStore } from '@/features/auth/stores/auth-store'

/**
 * stream-svc answers 403 NOT_CREATOR until it knows the caller's channel. Right after approval that can lag
 * identity by a moment, so a creator waits here (the Studio query keeps polling); anyone else is sent to apply.
 */
export function NotCreatorYet() {
  const { t } = useTranslation('studio')
  const creator = useAuthStore((s) => isCreator(s.me))

  useEffect(() => {
    void loadMe()
  }, [])

  if (creator) {
    return (
      <section role="status" className="flex items-center gap-3 rounded-xl border bg-surface p-5" data-testid="studio-preparing">
        <Loader2Icon className="size-5 animate-spin text-primary" aria-hidden />
        {t('notCreator.preparing')}
      </section>
    )
  }

  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border bg-surface p-5" data-testid="studio-not-creator">
      <h2 className="font-heading text-headline-sm">{t('notCreator.title')}</h2>
      <p className="text-body-sm text-muted-foreground">{t('notCreator.body')}</p>
      <Button asChild>
        <Link to="/creator/apply">
          <SparklesIcon />
          {t('notCreator.apply')}
        </Link>
      </Button>
    </section>
  )
}

