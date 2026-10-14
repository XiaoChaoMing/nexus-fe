import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { HouseIcon, SearchXIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { channelName } from '@/features/channels/lib/channel-display'
import { ChatColumn, ChatPanel, ChatRail } from '@/features/chat/components/chat-panel'
import { useChatRoom } from '@/features/chat/hooks/use-chat-room'
import { HlsPlayer } from '@/features/player/components/hls-player'
import { usePlayback } from '@/features/streams/hooks/use-playback'
import { useStreamRealtime } from '@/features/streams/hooks/use-stream-realtime'
import { useStream } from '@/features/streams/hooks/use-streams'
import { AboutTabs } from '@/features/watch/components/about-tabs'
import { ChannelInfo } from '@/features/watch/components/channel-info'
import { LiveEndedContent } from '@/features/watch/components/ended-content'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { useLocalFlag } from '@/hooks/use-local-flag'
import { useNow } from '@/hooks/use-now'
import { isApiError } from '@/lib/api-error'
import { useRealtimeStatus } from '@/lib/realtime'
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

/** Mentions of the viewer while the column was collapsed: a dot on "Mở chat" (NXL-B AF04). */
function useMentionsWhileCollapsed(mentions: number, collapsed: boolean): boolean {
  const [seen, setSeen] = useState(mentions)
  if (!collapsed && seen !== mentions) setSeen(mentions)

  return collapsed && mentions > seen
}

/**
 * /live/:streamId — 03 · Phòng Live (R3): player, channel card, "Giới thiệu" tab and the chat column (GĐ3,
 * collapsible, remembered). Tablet/mobile: chat becomes a tab; mobile: the player sticks to the top.
 * Status, title, VOD and the viewer count come from `stream:{id}` (polling stays as the fallback).
 */
export function LivePage() {
  const { streamId = '' } = useParams()
  const wsOpen = useRealtimeStatus() === 'open'
  const { data: stream, error, isPending } = useStream(streamId, { realtime: wsOpen })
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

  // Realtime while there is something to hear: on air, or ended and still waiting for the replay.
  useStreamRealtime(streamId, Boolean(stream) && (stream?.status !== 'ENDED' || !stream?.vodId))
  const room = useChatRoom({ streamId, channelId: stream?.channelId ?? '', status: stream?.status, endedOnArrival: endedOnArrival !== false })
  const mentionedWhileCollapsed = useMentionsWhileCollapsed(room.state.mentions, chatCollapsed)

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
              viewerCount={stream.viewerCount}
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
        {!theater && (
          <AboutTabs channel={stream.channel} chat={wide ? undefined : <ChatPanel room={room} channel={stream.channel} toolbar />} flat={layout === 'mobile'} />
        )}
      </div>

      {wide &&
        !theater &&
        (chatCollapsed ? (
          <ChatRail onExpand={() => setChatCollapsed(false)} mentioned={mentionedWhileCollapsed} />
        ) : (
          <ChatColumn room={room} channel={stream.channel} onCollapse={() => setChatCollapsed(true)} />
        ))}
    </div>
  )
}
