import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CircleAlertIcon, InfoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { ChatBadgeIcon } from '@/features/chat/components/chat-badge'
import { usernameColor, visibleBadges } from '@/features/chat/lib/appearance'
import { reportsApi, type ReportRequest } from '@/features/moderation/api'
import { useReportModal } from '@/features/moderation/stores/report-store'
import { MOD_LIMITS, REPORT_REASONS, type ReportReason, type ReportTarget } from '@/features/moderation/types'
import { errorCode, isApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

function requestOf(target: ReportTarget, reason: ReportReason, note: string): ReportRequest {
  const base = { targetType: target.type, targetId: target.id, reason, ...(note.trim() ? { note: note.trim() } : {}) }
  if (target.type === 'MESSAGE') return { ...base, streamId: target.streamId }
  if (target.type === 'USER' && target.streamId) return { ...base, streamId: target.streamId }

  return base
}

function Initials({ name, id }: { name: string; id: string }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-avatar text-body-md font-semibold" style={{ color: usernameColor(id) }} aria-hidden>
      {name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase()}
    </span>
  )
}

/** The block quoting what is reported (tin nhắn / người dùng / buổi phát / kênh). */
function TargetPreview({ target }: { target: ReportTarget }) {
  const box = 'flex w-full rounded-lg border bg-background px-3 py-2.5'
  switch (target.type) {
    case 'MESSAGE':
      return (
        <div className={cn(box, 'flex-col gap-0.5')} data-testid="report-target">
          <span className="flex items-center gap-1.25">
            {visibleBadges(target.author.badges).map((b) => (
              <ChatBadgeIcon key={b} badge={b} />
            ))}
            <span className="text-body-sm font-semibold" style={{ color: usernameColor(target.author.id, target.author.color) }}>
              {target.author.displayName}
            </span>
          </span>
          <span className="line-clamp-2 text-body-sm leading-4.75 break-words text-foreground">{target.body}</span>
        </div>
      )
    case 'USER':
      return (
        <div className={cn(box, 'items-center gap-3')} data-testid="report-target">
          <Initials name={target.displayName || target.username} id={target.id} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body-md font-semibold text-foreground">{target.displayName}</span>
            <span className="truncate text-body-sm text-muted-foreground">@{target.username}</span>
          </span>
        </div>
      )
    case 'STREAM':
      return (
        <div className={cn(box, 'items-center gap-3')} data-testid="report-target">
          <span className="aspect-video w-24 shrink-0 overflow-hidden rounded-control bg-card">
            {target.thumbnailUrl && <img src={target.thumbnailUrl} alt="" className="size-full object-cover" />}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 text-body-md font-semibold text-foreground">{target.title}</span>
            <span className="truncate text-body-sm text-muted-foreground">{target.channelName}</span>
          </span>
        </div>
      )
    case 'CHANNEL':
      return (
        <div className={cn(box, 'items-center gap-3')} data-testid="report-target">
          <ChannelAvatar channel={{ id: target.id, handle: target.handle, displayName: target.displayName, avatarUrl: target.avatarUrl }} size="lg" className="size-10" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body-md font-semibold text-foreground">{target.displayName}</span>
            <span className="truncate text-body-sm text-muted-foreground">@{target.handle}</span>
          </span>
        </div>
      )
  }
}

function ReportForm({ target, onDone }: { target: ReportTarget; onDone: () => void }) {
  const { t } = useTranslation('moderation')
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const noteId = useId()
  const questionId = useId()
  const tooLong = note.length > MOD_LIMITS.reportNoteMax

  const send = useMutation({
    mutationFn: (body: ReportRequest) => reportsApi.create(body),
    onSuccess: () => {
      toast.success(t('report.success'))
      onDone()
    },
    onError: (err) => {
      if (errorCode(err) === 'RATE_LIMITED') {
        const sec = isApiError(err) && err.retryAfterSec !== null ? err.retryAfterSec : 3600
        setError(t('report.rateLimited', { count: Math.max(1, Math.ceil(sec / 60)) }))
      } else {
        setError(t('report.failed'))
      }
    },
  })

  const title =
    target.type === 'MESSAGE'
      ? t('report.titleMessage')
      : target.type === 'USER'
        ? t('report.titleUser', { username: target.username })
        : target.type === 'STREAM'
          ? t('report.titleStream')
          : t('report.titleChannel')
  const canSubmit = reason !== null && !tooLong && !send.isPending
  const withEvidence = target.type === 'MESSAGE' || (target.type === 'USER' && target.streamId)

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        if (!reason || tooLong) return
        setError(null)
        send.mutate(requestOf(target, reason, note))
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6 max-md:px-4">
        <DialogTitle className="pr-10 text-headline-md leading-7 font-semibold">{title}</DialogTitle>
        <DialogDescription className="sr-only">{t('report.question')}</DialogDescription>
        {error && (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/15 px-3 py-2.5 text-[13px] leading-4.5 text-foreground" role="alert" data-testid="report-error">
            <CircleAlertIcon className="mt-px size-4.5 shrink-0 text-destructive" aria-hidden />
            {error}
          </p>
        )}
        <TargetPreview target={target} />
        <fieldset className="flex flex-col gap-1" disabled={send.isPending}>
          <legend id={questionId} className="mb-1 text-body-md font-semibold text-foreground">
            {t('report.question')}
          </legend>
          <div role="radiogroup" aria-labelledby={questionId} className="flex flex-col">
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  'flex h-10 cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-body-md text-foreground hover:bg-accent has-focus-visible:outline-2 has-focus-visible:outline-ring max-md:h-12',
                  reason === r && 'bg-card font-semibold',
                )}
              >
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="peer sr-only" />
                <span className={cn('grid size-4.5 shrink-0 place-items-center rounded-full outline-2 -outline-offset-2', reason === r ? 'outline-primary' : 'outline-muted-foreground')} aria-hidden>
                  {reason === r && <span className="size-2 rounded-full bg-primary" />}
                </span>
                {t(`report.reasons.${r}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={noteId} className="text-[13px] font-medium text-foreground">
            {t('report.note')}
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('report.notePlaceholder')}
            disabled={send.isPending}
            aria-invalid={tooLong}
            aria-describedby={`${noteId}-help`}
            className={cn(
              'h-24 w-full resize-none rounded-lg bg-background p-3 text-body-md text-foreground outline outline-border placeholder:text-subtle-foreground focus-visible:outline-2 focus-visible:outline-primary',
              tooLong && 'outline-destructive focus-visible:outline-destructive',
            )}
          />
          <div id={`${noteId}-help`} className="flex gap-2 text-label-sm font-normal">
            <span className={cn('flex-1', tooLong ? 'text-destructive' : 'text-muted-foreground')}>{tooLong ? t('report.noteTooLong') : ''}</span>
            <span className={cn('tabular-nums', tooLong ? 'text-destructive' : 'text-muted-foreground')}>
              {note.length}/{MOD_LIMITS.reportNoteMax}
            </span>
          </div>
        </div>
        {withEvidence && (
          <p className="flex items-start gap-2 text-label-sm leading-4.25 font-normal text-muted-foreground">
            <InfoIcon className="mt-px size-4 shrink-0" aria-hidden />
            {t('report.evidence')}
          </p>
        )}
      </div>
      <div className="flex shrink-0 justify-end gap-3 px-6 pt-2 pb-6 max-md:border-t max-md:bg-surface max-md:px-4 max-md:pt-3 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))] max-md:[&>button]:h-12 max-md:[&>button]:flex-1">
        <Button type="button" variant="secondary" className="font-medium" onClick={onDone} disabled={send.isPending}>
          {t('report.cancel')}
        </Button>
        <Button type="submit" aria-disabled={!canSubmit} loading={send.isPending} className={cn(!canSubmit && !send.isPending && 'opacity-40')} data-testid="report-submit">
          {t('report.submit')}
        </Button>
      </div>
    </form>
  )
}

/** Modal/Report: 480 px dialog on desktop, full-height bottom sheet on phones. */
export function ReportDialog() {
  const target = useReportModal((s) => s.target)
  const close = useReportModal((s) => s.close)

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent
        data-testid="report-modal"
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden bg-surface p-0 sm:max-w-120 max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:h-dvh max-md:max-h-dvh max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0 max-md:data-[state=open]:slide-in-from-bottom max-md:data-[state=closed]:slide-out-to-bottom max-md:data-[state=open]:zoom-in-100 max-md:data-[state=closed]:zoom-out-100"
      >
        {target && <ReportForm key={JSON.stringify(target)} target={target} onDone={close} />}
      </DialogContent>
    </Dialog>
  )
}
