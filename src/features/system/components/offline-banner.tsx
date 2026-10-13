import { useTranslation } from 'react-i18next'
import { WifiOffIcon } from 'lucide-react'
import { useOnline } from '@/hooks/use-online'

/** NXL-C E16 / NXL-00 §13: shown while the browser is offline; loaded data stays on screen. */
export function OfflineBanner() {
  const { t } = useTranslation('system')
  const online = useOnline()

  if (online) return null

  return (
    <div role="alert" data-testid="offline-banner" className="flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-label-md font-semibold text-black">
      <WifiOffIcon className="size-4" aria-hidden />
      {t('offline')}
    </div>
  )
}
