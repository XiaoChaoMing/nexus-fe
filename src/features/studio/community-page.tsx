import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { UsersIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorPanel } from '@/features/discover/components/list-states'
import { RestrictionsPanel } from '@/features/moderation/components/restrictions-panel'
import { RolesPanel } from '@/features/moderation/components/roles-panel'
import { TermsPanel } from '@/features/moderation/components/terms-panel'
import { NotCreatorYet } from '@/features/studio/components/not-creator'
import { useStudioChannel } from '@/features/studio/hooks/use-studio-data'
import { StudioPageHeader } from '@/features/studio/studio-layout'
import { errorCode } from '@/lib/api-error'

const TABS = ['mods', 'vips', 'terms', 'banned'] as const
type Tab = (typeof TABS)[number]

/**
 * /studio/community (20 · Studio — Cộng đồng, NXL-G2 ST-Q10): Moderator · VIP · Từ khóa chặn · Bị cấm (`?tab=`).
 * Every change is saved at once with a toast; a suspended channel can read the lists but not change them.
 */
export function StudioCommunityPage() {
  const { t } = useTranslation('moderation')
  const channel = useStudioChannel()
  const [sp, setSp] = useSearchParams()
  const raw = sp.get('tab')
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'mods'
  const c = channel.data
  const readOnly = c?.status === 'SUSPENDED'

  return (
    <div className="flex flex-col gap-5 px-4 py-6 md:px-10 md:pt-6 md:pb-12" data-testid="studio-community">
      <div className="flex flex-col gap-1">
        <StudioPageHeader title={t('community.title')} />
        <p className="text-body-md text-muted-foreground">{t('community.subtitle')}</p>
      </div>
      {errorCode(channel.error) === 'NOT_CREATOR' ? (
        <NotCreatorYet />
      ) : channel.isError ? (
        <ErrorPanel icon={UsersIcon} title={t('community.loadFailed')} onRetry={() => void channel.refetch()} />
      ) : !c ? (
        <Skeleton className="h-60 w-full max-w-[920px] rounded-panel bg-card" />
      ) : (
        <>
          <Tabs value={tab} onValueChange={(v) => setSp(v === 'mods' ? new URLSearchParams() : new URLSearchParams({ tab: v }), { replace: true })}>
            <TabsList aria-label={t('community.tabsLabel')} className="overflow-x-auto">
              {TABS.map((id) => (
                <TabsTrigger key={id} value={id}>
                  {t(`community.tabs.${id}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className={tab === 'banned' ? 'max-w-[1040px]' : 'max-w-[920px]'}>
            {tab === 'mods' && <RolesPanel channelId={c.id} role="MODERATOR" readOnly={readOnly} />}
            {tab === 'vips' && <RolesPanel channelId={c.id} role="VIP" readOnly={readOnly} />}
            {tab === 'terms' && <TermsPanel channelId={c.id} readOnly={readOnly} />}
            {tab === 'banned' && <RestrictionsPanel channelId={c.id} readOnly={readOnly} />}
          </div>
        </>
      )}
    </div>
  )
}
