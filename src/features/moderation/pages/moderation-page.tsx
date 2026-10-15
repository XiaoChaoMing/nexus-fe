import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { HouseIcon, PlayIcon, ShieldOffIcon, UsersIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { EmptyPanel, ErrorPanel } from '@/features/discover/components/list-states'
import { useMyChannelRoles } from '@/features/moderation/hooks/use-channel-roles'
import { RestrictionsPanel } from '@/features/moderation/components/restrictions-panel'
import { TermsPanel } from '@/features/moderation/components/terms-panel'
import { useChannelProfile } from '@/features/streams/hooks/use-streams'

const TABS = ['banned', 'terms'] as const
type Tab = (typeof TABS)[number]

/**
 * /moderation/:channel (21 · Kiểm duyệt kênh): what a Moderator manages outside the chat — Bị cấm and Từ khóa
 * chặn (with the link switch only). The channel comes from `/v1/me/channel-roles`; losing the role shows
 * "Bạn không còn là Moderator của kênh này".
 */
export function ModerationPage() {
  const { t } = useTranslation(['moderation', 'common'])
  const { channel: handle = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const tab: Tab = sp.get('tab') === 'terms' ? 'terms' : 'banned'
  const roles = useMyChannelRoles({ refetchInterval: 30_000 })
  const entry = roles.data?.find((r) => r.role === 'MODERATOR' && r.channel.handle.toLowerCase() === handle.toLowerCase())
  const profile = useChannelProfile(entry ? entry.channel.handle : undefined)

  if (roles.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-4 py-8" aria-busy data-testid="moderation-page">
        <div className="flex items-center gap-3.5">
          <Skeleton className="size-12 rounded-full bg-card" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-48 rounded-sm bg-card" />
            <Skeleton className="h-3 w-32 rounded-sm bg-card" />
          </div>
        </div>
        <Skeleton className="h-60 w-full rounded-panel bg-card" />
      </div>
    )
  }
  if (roles.isError) {
    return (
      <div className="mx-auto w-full max-w-[1040px] px-4 py-8" data-testid="moderation-page">
        <ErrorPanel icon={UsersIcon} title={t('modPage.loadFailed')} onRetry={() => void roles.refetch()} />
      </div>
    )
  }
  if (!entry) {
    return (
      <div className="mx-auto w-full max-w-[1040px] px-4 py-8" data-testid="moderation-page">
        <EmptyPanel icon={ShieldOffIcon} title={t('modPage.noLonger')} testId="moderation-no-longer">
          <Button asChild variant="secondary" className="font-medium">
            <Link to="/">
              <HouseIcon />
              {t('modPage.backHome')}
            </Link>
          </Button>
        </EmptyPanel>
      </div>
    )
  }

  const c = entry.channel
  const streamId = profile.data?.currentStream?.id ?? null

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-4 py-6 md:py-8" data-testid="moderation-page">
      <header className="flex flex-wrap items-center gap-3.5">
        <ChannelAvatar channel={c} size="lg" className="size-12 outline outline-border" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-heading text-headline-md font-bold text-foreground">{c.displayName}</h1>
            <span className="rounded-control bg-success/15 px-2 py-0.75 text-[11px] font-bold text-success uppercase">{t('modPage.badge')}</span>
            {c.isLive && (
              <span className="inline-flex items-center gap-1.25 rounded-control bg-live px-2 py-0.75 text-[11px] font-bold text-white uppercase">
                <span className="size-1.5 rounded-full bg-white" aria-hidden />
                {t('common:status.onAir')}
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground">{t('modPage.subtitle', { handle: c.handle })}</p>
        </div>
        {c.isLive && streamId && (
          <Button asChild className="max-md:w-full">
            <Link to={`/live/${streamId}`}>
              <PlayIcon className="fill-current" />
              {t('modPage.enterLive')}
            </Link>
          </Button>
        )}
      </header>
      <Tabs value={tab} onValueChange={(v) => setSp(v === 'terms' ? new URLSearchParams({ tab: 'terms' }) : new URLSearchParams(), { replace: true })}>
        <TabsList aria-label={t('modPage.tabsLabel')}>
          <TabsTrigger value="banned">{t('community.tabs.banned')}</TabsTrigger>
          <TabsTrigger value="terms">{t('community.tabs.terms')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'banned' ? <RestrictionsPanel channelId={c.id} /> : <TermsPanel channelId={c.id} />}
    </div>
  )
}
