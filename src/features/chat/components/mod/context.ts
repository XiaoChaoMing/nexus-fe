import { createContext, useContext } from 'react'
import type { ChatModeration, ModTarget } from '@/features/chat/hooks/use-chat-moderation'
import type { ChatMessage, ChatRole } from '@/features/chat/types'
import type { ReportTarget } from '@/features/moderation/types'

/** A point on screen to anchor a popover to (the line may scroll away or unmount meanwhile). */
export type Anchor = { getBoundingClientRect: () => DOMRect }

export function anchorOf(el: Element): Anchor {
  const rect = el.getBoundingClientRect()

  return { getBoundingClientRect: () => rect }
}

export type ChatModContextValue = {
  streamId: string
  channelId: string
  mod: ChatModeration
  canModerate: boolean
  myRole: ChatRole | undefined
  myId: string | null
  pinnedId: string | null
  blocked: ReadonlySet<string>
  muted: ReadonlySet<string>
  openCard: (user: ModTarget & { displayName: string }, anchor: Anchor) => void
  askBan: (user: ModTarget) => void
  askBlock: (user: ModTarget) => void
  unblock: (user: ModTarget) => void
  customTimeout: (user: ModTarget, anchor: Anchor) => void
  toggleMute: (user: ModTarget) => void
  report: (target: ReportTarget) => void
  reportMessage: (m: ChatMessage) => void
}

export const ChatModContext = createContext<ChatModContextValue | null>(null)

export function useChatMod(): ChatModContextValue {
  const ctx = useContext(ChatModContext)
  if (!ctx) throw new Error('useChatMod outside ChatModProvider')

  return ctx
}

/** For lines rendered outside a provider (tests, previews): no tools. */
export function useOptionalChatMod(): ChatModContextValue | null {
  return useContext(ChatModContext)
}
