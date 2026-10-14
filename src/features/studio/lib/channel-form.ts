import type { SocialLink } from '@/features/channels/types'
import type { ChannelPatch, StudioChannel } from '@/features/studio/types'

/** Studio → Kênh limits (TSD GĐ4 §8, NXL-D BR-D15…D17). */
export const BIO_MAX = 300
export const DISPLAY_NAME_MAX = 50
export const LINKS_MAX = 5
export const LINK_URL_MAX = 300

export type ChannelForm = { displayName: string; handle: string; bio: string; socialLinks: SocialLink[]; matureDefault: boolean }

export function formOf(c: StudioChannel): ChannelForm {
  return { displayName: c.displayName ?? '', handle: c.handle, bio: c.bio ?? '', socialLinks: c.socialLinks ?? [], matureDefault: c.matureDefault ?? false }
}

/** Only the fields that changed (the server needs ≥ 1); empty link rows are dropped, an empty bio is `null`. */
export function channelPatch(before: ChannelForm, after: ChannelForm): ChannelPatch {
  const p: ChannelPatch = {}
  if (after.displayName.trim() !== before.displayName) p.displayName = after.displayName.trim()
  if (after.handle !== before.handle) p.handle = after.handle
  if (after.bio.trim() !== before.bio) p.bio = after.bio.trim() || null
  const links = after.socialLinks.map((l) => ({ type: l.type, url: l.url.trim() })).filter((l) => l.url)
  if (JSON.stringify(links) !== JSON.stringify(before.socialLinks)) p.socialLinks = links
  if (after.matureDefault !== before.matureDefault) p.matureDefault = after.matureDefault

  return p
}
