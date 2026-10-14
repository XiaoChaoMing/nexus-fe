import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { channelName } from '@/features/channels/lib/channel-display'
import { useChannelProfile } from '@/features/streams/hooks/use-streams'
import type { ChannelSummary } from '@/features/streams/types'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

/** "Về {kênh}" with the channel bio from channel-svc; followers wait for GĐ4. */
function About({ channel }: { channel: ChannelSummary | null | undefined }) {
  const { t } = useTranslation('watch')
  const { data: profile, isPending } = useChannelProfile(channel?.handle)
  const name = channelName(channel)
  const bio = profile?.bio?.trim()

  return (
    <div className="flex flex-col gap-2 p-4 md:gap-3 md:p-5">
      {name && <h2 className="font-heading text-headline-sm text-foreground">{t('about.heading', { name })}</h2>}
      <p className={cn('text-body-md whitespace-pre-line text-muted-foreground', isPending && channel && 'animate-skeleton')}>
        {bio || (isPending && channel ? ' ' : t('about.noBio'))}
      </p>
    </div>
  )
}

type Props = {
  channel: ChannelSummary | null | undefined
  /** Below 1280 px the chat column becomes a tab next to "Giới thiệu": its content. */
  chat?: ReactNode
  /** Mobile: tabs span the width and the panel is not framed. */
  flat?: boolean
  /** The broadcast is on air: the Chat tab opens first (03 · Chat hoạt động/768, /375). */
  chatFirst?: boolean
}

/**
 * Tabs under the stream (Giới thiệu; Chat on tablet/mobile). Schedule, Clips and Badges stay hidden until built.
 * A request to focus the chat (guest signed in to chat, AF10) opens the Chat tab.
 */
export function AboutTabs({ channel, chat, flat = false, chatFirst = false }: Props) {
  const { t } = useTranslation('watch')
  const withChat = chat !== undefined
  const [tab, setTab] = useState(chatFirst && withChat ? 'chat' : 'about')
  const setChatTabOpen = useUiStore((s) => s.setChatTabOpen)
  useEffect(() => {
    setChatTabOpen(withChat && tab === 'chat')
  }, [withChat, tab, setChatTabOpen])
  useEffect(() => () => setChatTabOpen(false), [setChatTabOpen])
  const focusRequest = useUiStore((s) => s.chatFocusRequest)
  const initialRequest = useRef(focusRequest)
  const select = (next: string) => {
    setTab(next)
    // The chat fills the screen under the (sticky) player with its input above the bottom bar.
    if (next === 'chat') requestAnimationFrame(() => document.getElementById('chat')?.scrollIntoView({ block: 'end', behavior: 'smooth' }))
  }
  useEffect(() => {
    if (withChat && focusRequest !== initialRequest.current) select('chat')
  }, [focusRequest, withChat])

  return (
    <Tabs value={withChat ? tab : 'about'} onValueChange={select} className={cn('gap-0', !flat && 'rounded-panel border bg-surface')}>
      <TabsList className={cn('h-12 px-4! md:px-5!', flat && 'gap-0')}>
        <TabsTrigger value="about" className={flat ? 'flex-1!' : undefined}>
          {t('tabs.about')}
        </TabsTrigger>
        {withChat && (
          <TabsTrigger value="chat" className={flat ? 'flex-1!' : undefined}>
            {t('tabs.chat')}
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="about">
        <About channel={channel} />
      </TabsContent>
      {withChat && (
        <TabsContent value="chat" className="flex h-[calc(100dvh-56.25vw-10.5rem)] min-h-80 flex-none flex-col md:h-140">
          {chat}
        </TabsContent>
      )}
    </Tabs>
  )
}
