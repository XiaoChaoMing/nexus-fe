import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftIcon, CircleAlertIcon, RadioTowerIcon, RotateCwIcon, ShieldAlertIcon, TvMinimalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { DisplayState } from '@/features/player/lib/display-state'
import { PlayerActions, PlayerMessage, PlayerSpinner } from '@/features/player/components/player-message'

export type MatureGateProps = {
  /** "Không hỏi lại với kênh này" is shown to accounts only; guests confirm on every visit. */
  signedIn: boolean
  onAccept: () => void
  onBack: () => void
}

type Props = {
  state: DisplayState
  onRetry: () => void
  mature: MatureGateProps
  /** Content of the "ended" overlay (live: replay / processing / no replay; VOD: watched to the end). */
  endedContent?: ReactNode
}

const SCRIM = 'absolute inset-0 grid place-items-center overflow-y-auto py-4'

function MatureGate({ signedIn, onAccept, onBack }: MatureGateProps) {
  const { t } = useTranslation('player')
  const titleId = useId()
  const rememberId = useId()

  return (
    <div className={`${SCRIM} bg-background`} role="dialog" aria-modal="false" aria-labelledby={titleId} data-testid="mature-gate">
      <PlayerMessage icon={<ShieldAlertIcon />} title={t('overlay.matureTitle')} description={t('overlay.matureBody')} titleId={titleId}>
        <PlayerActions>
          <Button onClick={onAccept} autoFocus>
            {t('overlay.matureAccept')}
          </Button>
          <Button variant="secondary" className="font-medium" onClick={onBack}>
            <ArrowLeftIcon />
            {t('overlay.matureBack')}
          </Button>
        </PlayerActions>
        {signedIn && (
          // The server remembers an account's confirmation per channel; the box states it rather than toggles it.
          <div className="flex min-h-11 items-center gap-2.5">
            <Checkbox id={rememberId} checked disabled className="size-4.5 rounded-control disabled:cursor-default disabled:opacity-100" />
            <label htmlFor={rememberId} className="text-body-md text-muted-foreground">
              {t('overlay.matureRemember')}
            </label>
          </div>
        )}
      </PlayerMessage>
    </div>
  )
}

export function PlayerOverlay({ state, onRetry, mature, endedContent }: Props) {
  const { t } = useTranslation(['player', 'common'])

  switch (state) {
    case 'loading':
      return (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-label={t('common:loading')}>
          <PlayerSpinner />
        </div>
      )
    case 'buffering':
      // Dims the frame without blocking the controls.
      return (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/50" role="status" aria-label={t('overlay.buffering')}>
          <PlayerSpinner />
        </div>
      )
    case 'reconnecting':
      return (
        <div className={`${SCRIM} pointer-events-none bg-overlay`} role="status">
          <div className="flex flex-col items-center gap-4">
            <PlayerSpinner />
            <p className="font-heading text-headline-sm text-foreground sm:text-headline-md">{t('overlay.reconnecting')}</p>
          </div>
        </div>
      )
    case 'interrupted':
      return (
        <div className={`${SCRIM} bg-overlay backdrop-blur-sm`} role="status">
          <PlayerMessage icon={<RadioTowerIcon />} title={t('overlay.interrupted')} description={t('overlay.interruptedHint')} />
        </div>
      )
    case 'error':
      return (
        <div className={`${SCRIM} bg-background`} role="alert">
          <PlayerMessage icon={<CircleAlertIcon />} title={t('overlay.error')} description={t('overlay.errorHint')}>
            <Button onClick={onRetry}>
              <RotateCwIcon />
              {t('overlay.retry')}
            </Button>
          </PlayerMessage>
        </div>
      )
    case 'ended':
      return (
        <div className={`${SCRIM} bg-overlay`} role="status" data-testid="player-ended">
          {endedContent ?? <PlayerMessage icon={<TvMinimalIcon />} title={t('overlay.ended')} />}
        </div>
      )
    case 'mature':
      return <MatureGate {...mature} />
    default:
      return null
  }
}
