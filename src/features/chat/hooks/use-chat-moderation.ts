import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { ChatRoom } from '@/features/chat/hooks/use-chat-room'
import type { ChatMessage } from '@/features/chat/types'
import { modApi } from '@/features/moderation/api'
import { durationParts } from '@/features/moderation/lib/duration'
import { modError, type ModAction } from '@/features/moderation/lib/errors'
import type { ChannelRoleName } from '@/features/moderation/types'

export type ModTarget = { id: string; username: string }

/** Toasts are short and pile up in one place (design 03e: "Toast ngắn tự ẩn sau 4 giây"). */
const TOAST_MS = 4000

/**
 * Moderation calls of a chat room (TSD GĐ5 S2). No confirmation except Ban (asked by the caller); every result is
 * a short toast. The room changes for everyone through the `chat:` events, not here.
 */
export function useChatModeration(room: ChatRoom) {
  const { t } = useTranslation('moderation')
  const qc = useQueryClient()
  const { streamId, channelId, modLost } = room

  return useMemo(() => {
    const fail = (err: unknown, action: ModAction, username = '') => {
      const { key, lostRole } = modError(err, action)
      toast.error(t(key, { username }), { duration: TOAST_MS })
      if (lostRole) modLost()
    }
    const ok = (text: string) => toast.success(text, { duration: TOAST_MS })
    const refreshCard = (userId: string) => void qc.invalidateQueries({ queryKey: ['chat-card', channelId, userId] })
    const durationText = (sec: number) => {
      const { unit, count } = durationParts(sec)

      return t(`duration.${unit}`, { count })
    }

    return {
      deleteMessage: (m: ChatMessage) =>
        modApi.deleteMessage(streamId, m.id).then(
          () => ok(t('toast.deleted')),
          (err: unknown) => fail(err, 'delete'),
        ),
      timeout: (u: ModTarget, sec: number, reason?: string) =>
        modApi.timeout(channelId, u.id, sec, reason).then(
          () => {
            ok(t('toast.timedOut', { username: u.username, duration: durationText(sec) }))
            refreshCard(u.id)
          },
          (err: unknown) => fail(err, 'timeout', u.username),
        ),
      untimeout: (u: ModTarget) =>
        modApi.untimeout(channelId, u.id).then(
          () => {
            ok(t('toast.untimedOut', { username: u.username }))
            refreshCard(u.id)
          },
          (err: unknown) => fail(err, 'untimeout', u.username),
        ),
      ban: (u: ModTarget, reason?: string) =>
        modApi.ban(channelId, u.id, reason).then(
          () => {
            ok(t('toast.banned', { username: u.username }))
            refreshCard(u.id)

            return true
          },
          (err: unknown) => {
            fail(err, 'ban', u.username)

            return false
          },
        ),
      unban: (u: ModTarget) =>
        modApi.unban(channelId, u.id).then(
          () => {
            ok(t('toast.unbanned', { username: u.username }))
            refreshCard(u.id)
          },
          (err: unknown) => fail(err, 'unban', u.username),
        ),
      pin: (m: ChatMessage) =>
        modApi.pin(streamId, m.id).then(
          () => ok(t('toast.pinned')),
          (err: unknown) => fail(err, 'pin'),
        ),
      unpin: () =>
        modApi.unpin(streamId).then(
          () => ok(t('toast.unpinned')),
          (err: unknown) => fail(err, 'unpin'),
        ),
      setRole: (u: ModTarget, role: ChannelRoleName) =>
        modApi.setRole(channelId, u.id, role).then(
          () => {
            ok(t(role === 'MODERATOR' ? 'toast.roleMod' : 'toast.roleVip', { username: u.username }))
            refreshCard(u.id)
          },
          (err: unknown) => fail(err, 'role', u.username),
        ),
      removeRole: (u: ModTarget, role: ChannelRoleName) =>
        modApi.removeRole(channelId, u.id).then(
          () => {
            ok(t(role === 'MODERATOR' ? 'toast.roleRemovedMod' : 'toast.roleRemovedVip', { username: u.username }))
            refreshCard(u.id)
          },
          (err: unknown) => fail(err, 'role', u.username),
        ),
    }
  }, [t, qc, streamId, channelId, modLost])
}

export type ChatModeration = ReturnType<typeof useChatModeration>
