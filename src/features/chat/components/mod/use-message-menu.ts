import { useTranslation } from 'react-i18next'
import { anchorOf, useChatMod } from '@/features/chat/components/mod/context'
import type { ChatMessage } from '@/features/chat/types'
import { messageMenu, type MessageAction } from '@/features/moderation/lib/permissions'

/** The menu items of one line for the current viewer (Menu/Chat Message: Moderator or viewer variant). */
export function useMessageMenu(message: ChatMessage) {
  const { t } = useTranslation('moderation')
  const ctx = useChatMod()
  const isOwn = ctx.myId !== null && message.user.id === ctx.myId
  const items = messageMenu({
    signedIn: ctx.myId !== null,
    canModerate: ctx.canModerate,
    myRole: ctx.myRole,
    isOwn,
    isSystem: message.type === 'SYSTEM',
    deleted: message.deleted,
    pinned: ctx.pinnedId === message.id,
    authorBadges: message.user.badges,
    muted: ctx.muted.has(message.user.id),
    blocked: ctx.blocked.has(message.user.id),
  })
  const user = { id: message.user.id, username: message.user.username }
  const label = (a: MessageAction) => {
    switch (a) {
      case 'block':
      case 'unblock':
        return t(`menu.${a}`, { username: user.username })
      default:
        return t(`menu.${a}`)
    }
  }
  const run = (a: MessageAction, anchor?: Element | null) => {
    switch (a) {
      case 'delete':
        return void ctx.mod.deleteMessage(message)
      case 'timeout':
        if (anchor) ctx.customTimeout(user, anchorOf(anchor))

        return
      case 'ban':
        return ctx.askBan(user)
      case 'pin':
        return void ctx.mod.pin(message)
      case 'unpin':
        return void ctx.mod.unpin()
      case 'report':
        return ctx.reportMessage(message)
      case 'block':
        return ctx.askBlock(user)
      case 'unblock':
        return ctx.unblock(user)
      case 'mute':
      case 'unmute':
        return ctx.toggleMute(user)
    }
  }

  return { items, label, run, user, timeout: (sec: number) => void ctx.mod.timeout(user, sec) }
}
