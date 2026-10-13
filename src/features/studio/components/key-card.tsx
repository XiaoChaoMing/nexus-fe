import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownIcon, KeyRoundIcon, LinkIcon, RefreshCwIcon, ShieldAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CopyField } from '@/components/ui/copy-field'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateStreamKey, useStreamKeyInfo } from '@/features/streams/hooks/use-streams'
import type { StreamStatus } from '@/features/streams/types'
import { Panel, StatusPill } from '@/features/studio/components/panel'
import { formatDateTime } from '@/lib/format'

function ConnectionPill({ status }: { status: StreamStatus | null }) {
  const { t } = useTranslation('studio')

  if (status === 'LIVE') return <StatusPill tone="success">{t('key.connected')}</StatusPill>
  if (status === 'INTERRUPTED') return <StatusPill tone="warning">{t('key.signalLost')}</StatusPill>

  return <StatusPill tone="neutral">{t('key.waiting')}</StatusPill>
}

/** UC-G01: the key is shown once, right after it is created; only its hash is stored. */
export function KeyCard({ status }: { status: StreamStatus | null }) {
  const { t } = useTranslation('studio')
  const info = useStreamKeyInfo()
  const create = useCreateStreamKey()
  const [confirm, setConfirm] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)
  const hasKey = Boolean(info.data?.hasKey || fresh)

  const generate = () =>
    create.mutate(undefined, {
      onSuccess: (res) => {
        setFresh(res.streamKey)
        setConfirm(false)
        toast.success(t('key.createdToast'), { description: t('key.createdToastBody') })
      },
      onError: () => toast.error(t('key.createFailed')),
    })

  return (
    <Panel id="key-heading" title={t('key.title')} subtitle={t('key.subtitle')} icon={LinkIcon} aside={<ConnectionPill status={status} />}>
      {info.isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {info.data && <CopyField label={t('key.server')} value={info.data.rtmpUrl} />}

      {fresh && <CopyField label={t('key.streamKey')} value={fresh} secret hint={t('key.justCreated')} />}
      {!fresh && info.data?.hasKey && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium text-foreground">{t('key.streamKey')}</span>
            {info.data.createdAt && <span className="text-body-sm text-subtle-foreground">{t('key.createdAt', { date: formatDateTime(info.data.createdAt) })}</span>}
          </div>
          <div className="flex h-10 items-center rounded-lg bg-background px-3 font-mono text-[13px] tracking-widest text-muted-foreground" aria-label={t('key.hidden')}>
            ••••••••••••••••••••
          </div>
        </div>
      )}
      {info.data && !hasKey && (
        <p className="flex items-center gap-2 rounded-lg bg-card p-3 text-body-sm text-muted-foreground">
          <KeyRoundIcon className="size-4 shrink-0 text-primary" aria-hidden />
          {t('key.none')}
        </p>
      )}

      {hasKey && (
        <p role={fresh ? 'alert' : undefined} className="flex items-start gap-2.5 rounded-lg bg-warning/15 p-3 text-body-sm leading-[18px] text-muted-foreground">
          <ShieldAlertIcon className="size-4 shrink-0 text-warning" aria-hidden />
          {fresh ? t('key.saveNow') : t('key.securityNote')}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {hasKey ? (
          <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
            <RefreshCwIcon />
            {t('key.regenerate')}
          </Button>
        ) : (
          <Button onClick={generate} loading={create.isPending} disabled={info.isPending}>
            <KeyRoundIcon />
            {t('key.create')}
          </Button>
        )}
        <a href="#obs-heading" className="inline-flex items-center gap-1.5 rounded-control px-1 py-2 text-[13px] font-medium text-primary hover:underline">
          {t('key.obsGuide')}
          <ArrowDownIcon className="size-3.5" aria-hidden />
        </a>
      </div>

      <ConfirmDialog
        open={confirm}
        title={t('key.regenerateTitle')}
        confirmLabel={t('key.regenerateConfirm')}
        danger
        loading={create.isPending}
        onConfirm={generate}
        onClose={() => setConfirm(false)}
      >
        {t('key.regenerateBody')}
      </ConfirmDialog>
    </Panel>
  )
}
