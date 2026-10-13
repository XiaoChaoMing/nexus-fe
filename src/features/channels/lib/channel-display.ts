import type { ChannelSummary } from '@/features/streams/types'

/** Letter for the default avatar (NXL-D §3.5): first letter of the display name, else of the handle. */
export function channelInitial(channel: Pick<ChannelSummary, 'displayName' | 'handle'> | null | undefined): string {
  const source = (channel?.displayName || channel?.handle || '').trim()
  const first = [...source][0]

  return first ? first.toLocaleUpperCase() : '?'
}

export function channelName(channel: ChannelSummary | null | undefined): string | null {
  if (!channel) return null

  return channel.displayName?.trim() || channel.handle || null
}
