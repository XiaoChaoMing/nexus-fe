import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import type { DisplayState } from '@/features/player/lib/display-state'

type Props = {
  state: DisplayState
  onRetry: () => void
  onAcceptMature: () => void
  /** Rendered for the "ended" state (Xem lại / đang xử lý VOD). */
  endedSlot?: ReactNode
  endedLabel?: string
}

function Spinner() {
  return <span className="size-10 animate-spin rounded-full border-4 border-white/30 border-t-primary" aria-hidden />
}

export function PlayerOverlay({ state, onRetry, onAcceptMature, endedSlot, endedLabel }: Props) {
  const { t } = useTranslation(['player', 'common'])

  switch (state) {
    case 'loading':
    case 'buffering':
      return (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-label={t('common:loading')}>
          <Spinner />
        </div>
      )
    case 'reconnecting':
      return (
        <div className="absolute inset-0 grid place-items-center bg-deep/60" role="status">
          <div className="flex flex-col items-center gap-3 text-fg">
            <Spinner />
            {t('overlay.reconnecting')}
          </div>
        </div>
      )
    case 'interrupted':
      return (
        <div className="absolute inset-0 grid place-items-center bg-deep/75 p-6 text-center" role="status">
          <div className="max-w-sm">
            <p className="text-lg font-semibold text-fg">{t('overlay.interrupted')}</p>
            <p className="mt-2 text-fg-secondary">{t('overlay.interruptedHint')}</p>
          </div>
        </div>
      )
    case 'error':
      return (
        <div className="absolute inset-0 grid place-items-center bg-deep/85 p-6 text-center" role="alert">
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg font-semibold text-fg">{t('overlay.error')}</p>
            <Button onClick={onRetry}>{t('overlay.retry')}</Button>
          </div>
        </div>
      )
    case 'ended':
      return (
        <div className="absolute inset-0 grid place-items-center bg-deep/90 p-6 text-center" role="status">
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg font-semibold text-fg">{endedLabel ?? t('overlay.ended')}</p>
            {endedSlot}
          </div>
        </div>
      )
    case 'mature':
      return (
        <div className="absolute inset-0 grid place-items-center bg-deep p-6 text-center" role="dialog" aria-modal="false" aria-labelledby="mature-title">
          <div className="flex max-w-md flex-col items-center gap-3">
            <span className="rounded-control border border-warning px-2 py-0.5 text-xs font-bold text-warning">18+</span>
            <p id="mature-title" className="text-lg font-semibold text-fg">
              {t('overlay.matureTitle')}
            </p>
            <p className="text-fg-secondary">{t('overlay.matureBody')}</p>
            <Button onClick={onAcceptMature}>{t('overlay.matureAccept')}</Button>
          </div>
        </div>
      )
    default:
      return null
  }
}
