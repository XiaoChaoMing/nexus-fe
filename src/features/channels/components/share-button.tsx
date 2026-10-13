import { useTranslation } from 'react-i18next'
import { Share2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Icon button that copies the link of `path` (defaults to the current page) and confirms with a toast. */
export function ShareButton({ path, className }: { path?: string; className?: string }) {
  const { t } = useTranslation()

  const share = async () => {
    try {
      await navigator.clipboard.writeText(path ? new URL(path, window.location.origin).href : window.location.href)
      toast.success(t('actions.linkCopied'))
    } catch {
      // clipboard blocked: nothing else to do
    }
  }

  return (
    <Button variant="secondary" size="icon" className={cn('max-md:size-11', className)} aria-label={t('actions.share')} title={t('actions.share')} onClick={() => void share()}>
      <Share2Icon className="size-5" />
    </Button>
  )
}
