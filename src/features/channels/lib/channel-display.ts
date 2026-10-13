import type { ChannelSummary } from '@/features/streams/types'

/** Letter for the default avatar (NXL-D §3.5): first letter of the display name, else of the handle. */
export function channelInitial(channel: Pick<ChannelSummary, 'displayName' | 'handle'> | null | undefined): string {
  const source = (channel?.displayName || channel?.handle || '').trim()
  const first = [...source][0]

  return first ? first.toLocaleUpperCase() : '?'
}

/** Up to two letters for the initials avatar: "Kaelen Vanguard" → "KV", "creator" → "C". */
export function channelInitials(channel: Pick<ChannelSummary, 'displayName' | 'handle'> | null | undefined, max = 2): string {
  const words = (channel?.displayName || channel?.handle || '').trim().split(/\s+/).filter(Boolean)
  const letters = words.slice(0, max).map((w) => [...w][0]?.toLocaleUpperCase() ?? '')

  return letters.join('') || '?'
}

export function channelName(channel: ChannelSummary | null | undefined): string | null {
  if (!channel) return null

  return channel.displayName?.trim() || channel.handle || null
}
