import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { HouseIcon, SearchXIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { channelName } from '@/features/channels/lib/channel-display'
import { HlsPlayer } from '@/features/player/components/hls-player'
import { usePlayback } from '@/features/streams/hooks/use-playback'
import { useStream } from '@/features/streams/hooks/use-streams'
import { AboutTabs } from '@/features/watch/components/about-tabs'
import { ChannelInfo } from '@/features/watch/components/channel-info'
import { ChatColumn, ChatRail } from '@/features/watch/components/chat-placeholder'
import { LiveEndedContent } from '@/features/watch/components/ended-content'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { useLocalFlag } from '@/hooks/use-local-flag'
import { useNow } from '@/hooks/use-now'
import { isApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

const CHAT_COLLAPSED_KEY = 'nxl.chatCollapsed'

/** Theater mode lives in the page; the sidebar follows it through the UI store while the page is open. */
function useTheater(): [boolean, (on: boolean) => void] {
  const [theater, setTheater] = useState(false)
  const setUiTheater = useUiStore((s) => s.setTheater)

  useEffect(() => {
    setUiTheater(theater)
  }, [theater, setUiTheater])
  useEffect(() => () => setUiTheater(false), [setUiTheater])

  return [theater, setTheater]
}

function LivePageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 md:p-4 xl:p-6" aria-busy>
      <Skeleton className="aspect-video w-full rounded-none md:rounded-panel" />
      <Skeleton className="mx-4 h-24 md:mx-0 md:rounded-panel" />
    </div>
  )
}

function LiveNotAvailable({ notFound }: { notFound: boolean }) {
  const { t } = useTranslation(['watch', 'common'])

  return (
    <div className="grid place-items-center px-4 py-16">
      <Empty className="max-w-xl rounded-panel border bg-surface">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>
            <h1 className="font-heading text-headline-sm">{notFound ? t('notFound') : t('loadFailed')}</h1>
          </EmptyTitle>
          {notFound && <EmptyDescription>{t('notFoundBody')}</EmptyDescription>}
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/">
              <HouseIcon />
              {t('common:actions.backHome')}
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}

/**
 * /live/:streamId — 03 · Phòng Live (R3): player, channel card, "Giới thiệu" tab and the chat column kept for
 * GĐ3 (collapsible, remembered). Tablet: chat becomes a tab; mobile: the player sticks to the top.
 */
export function LivePage() {
  const { streamId = '' } = useParams()
  const { data: stream, error, isPending } = useStream(streamId)
  const [theater, setTheater] = useTheater()
  const [chatCollapsed, setChatCollapsed] = useLocalFlag(CHAT_COLLAPSED_KEY)
  const wide = useMediaQuery(MEDIA.xl)
  const tablet = useMediaQuery(MEDIA.md)
  const now = useNow(5000)

  // A broadcast that was already over when the page opened shows the ended screen without a player; one that
  // ends while watching keeps the player, so a rewound viewer can finish what was recorded.
  const [endedOnArrival, setEndedOnArrival] = useState<boolean | null>(null)
  if (stream && endedOnArrival === null) setEndedOnArrival(stream.status === 'ENDED')
  const showPlayer = endedOnArrival === false

  const playback = usePlayback('stream', streamId, showPlayer)

  if (isPending) return <LivePageSkeleton />
  if (error || !stream) return <LiveNotAvailable notFound={isApiError(error) && error.status === 404} />

  const layout = wide ? 'desktop' : tablet ? 'tablet' : 'mobile'
  const decision = playback.decision
  const name = channelName(stream.channel)

  return (
    <div className={cn('mx-auto flex w-full gap-6 md:p-4 xl:p-6', theater ? 'max-w-none' : 'max-w-[1600px]')}>
      <div className="flex min-w-0 flex-1 flex-col md:gap-4 xl:gap-5">
        <div className="bg-black max-md:sticky max-md:top-0 max-md:z-20 md:bg-transparent">
          {showPlayer ? (
            <HlsPlayer
              src={decision?.kind === 'ready' ? decision.manifestUrl : null}
              mode="live"
              streamStatus={stream.status}
              session={{
                matureBlocked: decision?.kind === 'mature',
                failed: playback.failed || decision?.kind === 'unavailable',
                onAcceptMature: playback.acknowledge,
                onRetry: playback.retry,
              }}
              theater={theater}
              onTheaterChange={setTheater}
              endedContent={<LiveEndedContent stream={stream} now={now} />}
              heading={{ title: name ?? stream.title, subtitle: name ? stream.title : undefined }}
              className="max-md:rounded-none max-md:border-0"
            />
          ) : (
            <div
              className="relative grid aspect-video place-items-center overflow-y-auto bg-surface py-4 md:rounded-panel md:border"
              data-testid="ended-screen"
              role="status"
            >
              <LiveEndedContent stream={stream} now={now} />
            </div>
          )}
        </div>

        <ChannelInfo stream={stream} now={now} layout={layout} />
        {!theater && <AboutTabs channel={stream.channel} withChat={!wide} flat={layout === 'mobile'} />}
      </div>

      {wide && !theater && (chatCollapsed ? <ChatRail onExpand={() => setChatCollapsed(false)} /> : <ChatColumn onCollapse={() => setChatCollapsed(true)} />)}
    </div>
  )
}
