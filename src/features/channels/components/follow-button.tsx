import { useTranslation } from 'react-i18next'
import { HeartIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { channelName } from '@/features/channels/lib/channel-display'
import type { ChannelSummary } from '@/features/streams/types'

/**
 * Follow (NXL-D §3.7). GĐ1: guests get the login modal with the follow remembered (BR-D10); signed-in users
 * get the intent recorded and a note that following arrives in GĐ4. No backend call yet.
 */
export function FollowButton({ channel }: { channel: ChannelSummary | null | undefined }) {
  const { t } = useTranslation('watch')
  const own = useAuthStore((s) => Boolean(channel && s.me?.channelId === channel.id))
  const gated = useGatedAction()

  if (!channel || own) return null

  return (
    <Button
      size="sm"
      onClick={() => gated({ type: 'follow', params: { channelId: channel.id, channelName: channelName(channel) ?? '' } })}
      data-testid="follow-button"
    >
      <HeartIcon />
      {t('follow')}
    </Button>
  )
}
