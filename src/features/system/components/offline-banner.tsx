import { useTranslation } from 'react-i18next'
import { WifiOffIcon } from 'lucide-react'
import { Banner } from '@/components/ui/banner'
import { useOnline } from '@/hooks/use-online'

/** NXL-C E16 / NXL-00 §13: shown while the browser is offline; loaded data stays on screen. */
export function OfflineBanner() {
  const { t } = useTranslation('system')
  const online = useOnline()

  if (online) return null

  return (
    <Banner role="alert" data-testid="offline-banner" variant="warning" icon={<WifiOffIcon aria-hidden />}>
      {t('offline')}
    </Banner>
  )
}
