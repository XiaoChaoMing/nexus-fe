import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BadgeCheckIcon, ImageIcon, PlusIcon, Trash2Icon, UserRoundCogIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { channelInitials } from '@/features/channels/lib/channel-display'
import { handleError } from '@/features/channels/lib/handle'
import { SOCIAL_LINK_TYPES, type SocialLinkType } from '@/features/channels/types'
import { ErrorPanel } from '@/features/discover/components/list-states'
import { studioV4Api, type ImageKind } from '@/features/studio/api'
import { NotCreatorYet } from '@/features/studio/components/not-creator'
import { studioKeys, useStudioChannel } from '@/features/studio/hooks/use-studio-data'
import { StudioPageHeader } from '@/features/studio/studio-layout'
import { BIO_MAX, channelPatch, DISPLAY_NAME_MAX, formOf, LINK_URL_MAX, LINKS_MAX, type ChannelForm as Form } from '@/features/studio/lib/channel-form'
import type { ChannelPatch, StudioChannel } from '@/features/studio/types'
import { useNow } from '@/hooks/use-now'
import { detailString, errorCode, isApiError } from '@/lib/api-error'
import { formatDate, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_LIMITS: Record<ImageKind, { bytes: number; mb: number; min: string }> = {
  avatar: { bytes: 2 * 1024 * 1024, mb: 2, min: '128×128' },
  banner: { bytes: 5 * 1024 * 1024, mb: 5, min: '800×250' },
}

type FieldErrors = Partial<Record<'displayName' | 'handle' | 'bio' | 'socialLinks', string>>

function useImageUpload(kind: ImageKind) {
  const { t } = useTranslation('studio')
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => studioV4Api.uploadImage(kind, file),
    onSuccess: () => toast.success(kind === 'avatar' ? t('channelSettings.avatarSaved') : t('channelSettings.bannerSaved')),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: studioKeys.channel })
      void qc.invalidateQueries({ queryKey: ['channels'] })
    },
  })
}

/** Upload/Image: drop zone (square for the avatar, 16:5 for the banner), preview, limits, uploads right away. */
function ImageField({ kind, current, label, hint }: { kind: ImageKind; current: string | null; label: string; hint: string }) {
  const { t } = useTranslation('studio')
  const inputId = useId()
  const upload = useImageUpload(kind)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const limits = IMAGE_LIMITS[kind]

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const pick = (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!IMAGE_TYPES.includes(file.type)) return setError(t('channelSettings.badFormat'))
    if (file.size > limits.bytes) return setError(t('channelSettings.tooLarge', { size: limits.mb }))
    setPreview(URL.createObjectURL(file))
    upload.mutate(file, {
      onError: (err) => {
        setPreview(null)
        const code = errorCode(err)
        const field = detailString(err, 'file')
        setError(
          code === 'PAYLOAD_TOO_LARGE'
            ? t('channelSettings.tooLarge', { size: limits.mb })
            : field === 'MIN'
              ? t('channelSettings.tooSmall', { size: limits.min })
              : field === 'FORMAT'
                ? t('channelSettings.badFormat')
                : t('channelSettings.uploadFailed'),
        )
      },
    })
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files[0])
  }
  const shown = preview ?? current

  return (
    <div className="flex flex-col gap-1.5" data-testid={`upload-${kind}`}>
      <span className="text-[13px] font-medium">{label}</span>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-lg border border-dashed bg-background',
          kind === 'avatar' ? 'size-32' : 'aspect-[16/5] w-full',
          dragging && 'border-primary',
          error && 'border-destructive',
        )}
      >
        {shown ? (
          <img src={shown} alt="" className={cn('size-full object-cover', upload.isPending && 'opacity-50')} />
        ) : (
          <span className="flex flex-col items-center gap-1 p-3 text-center text-label-sm font-normal text-muted-foreground">
            <ImageIcon className="size-6" aria-hidden />
            {t('channelSettings.drop')}
          </span>
        )}
        {upload.isPending && <span className="absolute inset-x-0 bottom-0 bg-overlay py-1 text-center text-label-sm text-white">{t('channelSettings.uploading')}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-secondary px-3 text-label-md font-semibold hover:border-border-strong focus-within:outline-2 focus-within:outline-ring max-md:h-11">
          {shown ? t('channelSettings.change') : t('channelSettings.choose')}
          <input
            id={inputId}
            type="file"
            accept={IMAGE_TYPES.join(',')}
            className="sr-only"
            onChange={(e) => {
              pick(e.target.files?.[0])
              e.target.value = ''
            }}
            disabled={upload.isPending}
            data-testid={`upload-${kind}-input`}
          />
        </label>
      </div>
      <p className="text-body-sm text-subtle-foreground">{hint}</p>
      {error && (
        <p role="alert" className="text-body-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Header/Channel preview updated live from the form. */
function Preview({ channel, form }: { channel: StudioChannel; form: Form }) {
  const { t } = useTranslation(['studio', 'channel'])
  const name = form.displayName.trim() || channel.handle

  return (
    <section aria-label={t('studio:channelSettings.preview')} className="flex flex-col overflow-hidden rounded-panel border bg-surface" data-testid="channel-preview">
      <div className="aspect-[16/5] w-full bg-card">{channel.bannerUrl && <img src={channel.bannerUrl} alt="" className="size-full object-cover" />}</div>
      <div className="flex flex-col gap-1 px-4 pb-4">
        <Avatar className="-mt-8 size-16 ring-3 ring-surface">
          {channel.avatarUrl && <AvatarImage src={channel.avatarUrl} alt="" className="object-cover" />}
          <AvatarFallback aria-hidden>{channelInitials({ displayName: name, handle: form.handle })}</AvatarFallback>
        </Avatar>
        <span className="flex items-center gap-1.5 pt-1 font-heading text-lg font-semibold">
          {name}
          {channel.verified && <BadgeCheckIcon className="size-4.5 text-primary" aria-hidden />}
        </span>
        <span className="text-body-sm text-muted-foreground">
          @{form.handle} · {t('channel:profile.followerCount', { value: formatNumber(channel.followerCount) })}
        </span>
        {form.bio.trim() && <p className="line-clamp-3 pt-1 text-body-sm whitespace-pre-line text-muted-foreground">{form.bio}</p>}
      </div>
    </section>
  )
}

function ChannelForm({ channel }: { channel: StudioChannel }) {
  const { t } = useTranslation(['studio', 'channel'])
  const qc = useQueryClient()
  const ids = { name: useId(), handle: useId(), bio: useId(), mature: useId() }
  const base = formOf(channel)
  const [form, setForm] = useState<Form>(base)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)
  const [confirmHandle, setConfirmHandle] = useState(false)
  const baseKey = JSON.stringify(base)
  const lastBase = useRef(baseKey)
  // A save (or another tab) refreshed the channel: start again from the server values when nothing is pending.
  useEffect(() => {
    if (lastBase.current === baseKey) return
    lastBase.current = baseKey
    setForm(formOf(channel))
  }, [baseKey, channel])

  const now = useNow(60_000)
  const nextChange = lockedUntil ?? (channel.nextHandleChangeAt && Date.parse(channel.nextHandleChangeAt) > now ? channel.nextHandleChangeAt : null)
  const patch = channelPatch(base, form)
  const dirty = Object.keys(patch).length > 0
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const save = useMutation({
    mutationFn: (p: ChannelPatch) => studioV4Api.updateChannel(p),
    onSuccess: (c) => {
      qc.setQueryData(studioKeys.channel, c)
      void qc.invalidateQueries({ queryKey: ['channels'] })
      toast.success(t('studio:channelSettings.saved'))
    },
    onError: (err) => {
      const code = errorCode(err)
      if (code === 'HANDLE_TAKEN') return setErrors({ handle: t('studio:channelSettings.handleTaken') })
      if (code === 'CONFLICT' && detailString(err, 'nextChangeAt')) {
        setLockedUntil(detailString(err, 'nextChangeAt'))
        setForm((f) => ({ ...f, handle: base.handle }))

        return
      }
      if (code === 'VALIDATION_FAILED' && isApiError(err)) {
        const d = err.details
        setErrors({
          displayName: d.displayName ? t('studio:channelSettings.nameLength') : undefined,
          bio: d.bio ? t('studio:channelSettings.bioMax') : undefined,
          handle: d.handle === 'INVALID' ? t('studio:channelSettings.handleInvalid') : d.handle ? t('studio:channelSettings.handleHint') : undefined,
          socialLinks: d.socialLinks === 'MAX' ? t('studio:channelSettings.linksMax') : d.socialLinks ? t('studio:channelSettings.linkFormat') : undefined,
        })

        return
      }
      toast.error(t('studio:channelSettings.saveFailed'))
    },
  })

  const validate = (): boolean => {
    const e: FieldErrors = {}
    const name = form.displayName.trim()
    if ([...name].length < 1 || [...name].length > DISPLAY_NAME_MAX) e.displayName = t('studio:channelSettings.nameLength')
    if ([...form.bio.trim()].length > BIO_MAX) e.bio = t('studio:channelSettings.bioMax')
    const he = form.handle !== base.handle ? handleError(form.handle) : null
    if (he) e.handle = he === 'INVALID' ? t('studio:channelSettings.handleInvalid') : t('studio:channelSettings.handleHint')
    if (form.socialLinks.some((l) => l.url.trim() && (!/^https:\/\/\S+$/.test(l.url.trim()) || l.url.trim().length > LINK_URL_MAX))) e.socialLinks = t('studio:channelSettings.linkFormat')
    setErrors(e)

    return Object.values(e).every((v) => !v)
  }

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    if (!dirty || !validate()) return
    if (patch.handle) setConfirmHandle(true)
    else save.mutate(patch)
  }
  const field = 'h-10 w-full rounded-lg border border-transparent bg-background px-3 text-[13px] outline-none focus:border-primary aria-[invalid=true]:border-destructive max-md:h-11'
  const err = (id: string, text: string | undefined) =>
    text ? (
      <p id={`${id}-err`} className="text-body-sm text-destructive">
        {text}
      </p>
    ) : null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="order-first lg:order-last">
        <div className="lg:sticky lg:top-20">
          <Preview channel={channel} form={form} />
        </div>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 pb-24" data-testid="channel-form">
        <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
          <ImageField kind="avatar" current={channel.avatarUrl} label={t('studio:channelSettings.avatar')} hint={t('studio:channelSettings.avatarHint')} />
          <ImageField kind="banner" current={channel.bannerUrl} label={t('studio:channelSettings.banner')} hint={t('studio:channelSettings.bannerHint')} />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={ids.name} className="text-[13px] font-medium">
              {t('studio:channelSettings.displayName')}
            </label>
            <span className="text-body-sm text-subtle-foreground tabular-nums">
              {[...form.displayName].length}/{DISPLAY_NAME_MAX}
            </span>
          </div>
          <input id={ids.name} value={form.displayName} maxLength={DISPLAY_NAME_MAX} onChange={(e) => set('displayName', e.target.value)} aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? `${ids.name}-err` : undefined} className={field} data-testid="channel-display-name" />
          {err(ids.name, errors.displayName)}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.handle} className="text-[13px] font-medium">
            {t('studio:channelSettings.handle')}
          </label>
          <div className={cn('flex h-10 items-center rounded-lg border border-transparent bg-background focus-within:border-primary max-md:h-11', errors.handle && 'border-destructive', nextChange && 'opacity-70')}>
            <span className="pl-3 text-[13px] text-subtle-foreground">{t('studio:channelSettings.handlePrefix')}</span>
            <input
              id={ids.handle}
              value={form.handle}
              onChange={(e) => set('handle', e.target.value.toLowerCase())}
              readOnly={nextChange !== null}
              maxLength={25}
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(errors.handle)}
              aria-describedby={`${ids.handle}-hint${errors.handle ? ` ${ids.handle}-err` : ''}`}
              className="h-full min-w-0 flex-1 bg-transparent pr-3 text-[13px] outline-none"
              data-testid="channel-handle"
            />
          </div>
          <p id={`${ids.handle}-hint`} className="text-body-sm text-subtle-foreground">
            {nextChange ? t('studio:channelSettings.handleLocked', { date: formatDate(nextChange, { dateStyle: 'short' }) }) : `${t('studio:channelSettings.handleHint')}. ${t('studio:channelSettings.handleNote')}`}
          </p>
          {err(ids.handle, errors.handle)}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={ids.bio} className="text-[13px] font-medium">
              {t('studio:channelSettings.bio')}
            </label>
            <span className={cn('text-body-sm tabular-nums', [...form.bio].length > BIO_MAX ? 'text-destructive' : 'text-subtle-foreground')}>
              {[...form.bio].length}/{BIO_MAX}
            </span>
          </div>
          <textarea id={ids.bio} rows={4} value={form.bio} onChange={(e) => set('bio', e.target.value)} aria-invalid={Boolean(errors.bio)} aria-describedby={errors.bio ? `${ids.bio}-err` : undefined} className="resize-y rounded-lg border border-transparent bg-background px-3 py-2.5 text-[13px] outline-none focus:border-primary aria-[invalid=true]:border-destructive" data-testid="channel-bio-input" />
          {err(ids.bio, errors.bio)}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1.5 text-[13px] font-medium">{t('studio:channelSettings.links')}</legend>
          {form.socialLinks.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                aria-label={t('studio:channelSettings.linkType')}
                value={l.type}
                onChange={(e) => set('socialLinks', form.socialLinks.map((x, j) => (j === i ? { ...x, type: e.target.value as SocialLinkType } : x)))}
                className="h-10 w-32 shrink-0 rounded-lg border border-transparent bg-background px-2 text-[13px] outline-none focus:border-primary max-md:h-11"
              >
                {SOCIAL_LINK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`channel:links.${type}`)}
                  </option>
                ))}
              </select>
              <input
                type="url"
                inputMode="url"
                placeholder="https://"
                aria-label={t('studio:channelSettings.linkUrl')}
                value={l.url}
                maxLength={LINK_URL_MAX}
                onChange={(e) => set('socialLinks', form.socialLinks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                className={field}
              />
              <Button type="button" variant="ghost" size="icon" className="max-md:size-11" aria-label={t('studio:channelSettings.removeLink')} onClick={() => set('socialLinks', form.socialLinks.filter((_, j) => j !== i))}>
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          ))}
          {errors.socialLinks && <p className="text-body-sm text-destructive">{errors.socialLinks}</p>}
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" size="sm" disabled={form.socialLinks.length >= LINKS_MAX} onClick={() => set('socialLinks', [...form.socialLinks, { type: 'WEBSITE', url: '' }])}>
              <PlusIcon />
              {t('studio:channelSettings.addLink')}
            </Button>
            {form.socialLinks.length >= LINKS_MAX && <span className="text-body-sm text-subtle-foreground">{t('studio:channelSettings.linksMax')}</span>}
          </div>
        </fieldset>

        <div className="flex items-center gap-3 rounded-lg bg-card p-3">
          <label htmlFor={ids.mature} className="flex-1 text-[13px] font-semibold">
            {t('studio:channelSettings.mature')}
          </label>
          <Switch id={ids.mature} checked={form.matureDefault} onCheckedChange={(v) => set('matureDefault', v)} />
        </div>

        {dirty && (
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-surface md:bottom-0 lg:left-auto lg:w-[calc(100%-15rem)]" data-testid="save-bar">
            <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3">
              <span className="flex-1 text-body-md text-foreground">{t('studio:channelSettings.unsaved')}</span>
              <Button type="button" variant="ghost" onClick={() => setForm(base)}>
                {t('studio:channelSettings.discard')}
              </Button>
              <Button type="submit" loading={save.isPending} data-testid="channel-save">
                {t('studio:channelSettings.save')}
              </Button>
            </div>
          </div>
        )}
      </form>

      <ConfirmDialog
        open={confirmHandle}
        title={t('studio:channelSettings.handleConfirmTitle', { handle: form.handle })}
        confirmLabel={t('studio:channelSettings.handleConfirm')}
        onConfirm={() => {
          setConfirmHandle(false)
          save.mutate(patch)
        }}
        onClose={() => setConfirmHandle(false)}
      >
        {t('studio:channelSettings.handleConfirmBody', { old: base.handle })}
      </ConfirmDialog>
    </div>
  )
}

/** /studio/channel — 19 · Studio Kênh: images (upload at once), name, handle (30-day rule), bio, links, 18+ default. */
export function StudioChannelPage() {
  const { t } = useTranslation('studio')
  const channel = useStudioChannel()

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6" data-testid="studio-channel">
      <StudioPageHeader title={t('channelSettings.title')} />
      {errorCode(channel.error) === 'NOT_CREATOR' ? (
        <NotCreatorYet />
      ) : channel.isError ? (
        <ErrorPanel icon={UserRoundCogIcon} title={t('channelSettings.loadFailed')} onRetry={() => void channel.refetch()} />
      ) : !channel.data ? (
        <Skeleton className="h-96 rounded-panel" />
      ) : (
        <ChannelForm channel={channel.data} />
      )}
    </div>
  )
}
