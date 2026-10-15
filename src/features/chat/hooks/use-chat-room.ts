import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { chatApi } from '@/features/chat/api/chat-api'
import { useEmotes } from '@/features/chat/hooks/use-emotes'
import { chatReducer, initialChatState, recentChatters, type ChatState, type IncomingEvent } from '@/features/chat/lib/chat-state'
import { checkDraft, localFragments } from '@/features/chat/lib/compose'
import { CHAT_LIMITS } from '@/features/chat/lib/constants'
import { composerView, errorEffect, exemptFromSlow, type ComposerView, type ConnectionView } from '@/features/chat/lib/errors'
import { parseChatEvent, parseChatSnapshot } from '@/features/chat/lib/parse'
import type { ChatMessage } from '@/features/chat/types'
import { randomUuid } from '@/features/streams/lib/anon-id'
import type { StreamStatus } from '@/features/streams/types'
import { useNow } from '@/hooks/use-now'
import { isApiError } from '@/lib/api-error'
import { realtime, useRealtimeStatus, useRealtimeTopic, type ConnectionStatus, type ErrorFrame, type EventFrame } from '@/lib/realtime'

export type ChatRoom = {
  streamId: string
  channelId: string
  state: ChatState
  connection: ConnectionView
  view: ComposerView
  me: { id: string; username: string } | null
  chatters: ReturnType<typeof recentChatters>
  /** Body of a message the server refused, handed back to the input (BR26, AF07: draft kept). */
  returned: { body: string; nonce: number } | null
  /** Sends a draft; false when it was not sent (invalid, locked, guest → login modal). */
  send: (draft: string) => boolean
  retry: (clientMsgId: string) => void
  setPaused: (paused: boolean) => void
  clearNotice: () => void
  reconnect: () => void
  /** A moderation call was refused (role removed): hide the tools until the next snapshot. */
  modLost: () => void
}

type Options = {
  streamId: string
  channelId: string
  status: StreamStatus | undefined
  /** The broadcast was already over when the page opened: history only, no live connection (AF08). */
  endedOnArrival: boolean
}

function connectionView(status: ConnectionStatus, subscribed: boolean, signedIn: boolean): ConnectionView {
  switch (status) {
    case 'open':
      return subscribed ? 'open' : 'connecting'
    case 'reconnecting':
    case 'failed':
      return status
    case 'forbidden':
      // 4003 for an account: it was locked (TSD GĐ5 §5.8); nothing reconnects.
      return signedIn ? 'locked' : 'unavailable'
    case 'unsupported':
      return 'unavailable'
    default:
      return 'connecting'
  }
}

/** Runs `fn` once per animation frame with everything queued since (NXL-B §14: render in batches). */
function useFrameBatch<T>(flush: (items: T[]) => void) {
  const queue = useRef<T[]>([])
  const scheduled = useRef(false)
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  })

  return useCallback((item: T) => {
    queue.current.push(item)
    if (scheduled.current) return
    scheduled.current = true
    const run = () => {
      scheduled.current = false
      const items = queue.current
      queue.current = []
      if (items.length > 0) flushRef.current(items)
    }
    // Hidden tabs get no animation frames: a slow timer keeps the queue from growing without bound.
    if (typeof document !== 'undefined' && document.hidden) window.setTimeout(run, 250)
    else window.requestAnimationFrame(run)
  }, [])
}

/**
 * Chat room of a live stream (NXL-B): REST history + `chat:{streamId}` live events + optimistic sends. Lives in
 * the page (not the panel) so a collapsed column keeps the connection and its state (AF04).
 */
export function useChatRoom({ streamId, channelId, status, endedOnArrival }: Options): ChatRoom {
  const [state, dispatch] = useReducer(chatReducer, initialChatState)
  const user = useAuthStore((s) => s.user)
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const gated = useGatedAction()
  const realtimeStatus = useRealtimeStatus()
  const { byCode } = useEmotes()
  const [returned, setReturned] = useState<{ body: string; nonce: number } | null>(null)
  const timers = useRef(new Map<string, number>())
  const bodies = useRef(new Map<string, string>())
  const [subscribed, setSubscribed] = useState(false)
  const topic = endedOnArrival ? null : `chat:${streamId}`
  const me = useMemo(() => (user ? { id: user.id, username: user.username } : null), [user])
  const meRef = useRef(me)
  useEffect(() => {
    meRef.current = me
  })

  const clearTimer = useCallback((clientMsgId: string) => {
    const t = timers.current.get(clientMsgId)
    if (t !== undefined) window.clearTimeout(t)
    timers.current.delete(clientMsgId)
  }, [])

  const enqueue = useFrameBatch<IncomingEvent>((events) => {
    for (const ev of events) if (ev.type === 'ack') clearTimer(ev.clientMsgId)
    dispatch({ type: 'batch', events, myId: meRef.current?.id ?? null, myUsername: meRef.current?.username ?? null })
  })

  // History (API 01) on join and after a resync; an answer for a room we already left is dropped.
  const roomRef = useRef(streamId)
  const loadHistory = useCallback(
    (resync: boolean) => {
      const forRoom = streamId

      return chatApi
        .history(streamId)
        .then((messages) => {
          if (roomRef.current === forRoom) dispatch({ type: 'history', messages, resync })
        })
        .catch((err: unknown) => {
          if (roomRef.current !== forRoom) return
          // No room yet (just went live) reads as an empty room; anything else is "chat unavailable".
          if (isApiError(err) && err.status === 404) dispatch({ type: 'history', messages: [], resync })
          else dispatch({ type: 'historyFailed' })
        })
    },
    [streamId],
  )

  useEffect(() => {
    roomRef.current = streamId
    dispatch({ type: 'reset' })
    void loadHistory(false)
  }, [streamId, loadHistory])

  // Pending sends of a room we leave are forgotten with it.
  useEffect(() => {
    const pending = timers.current
    const sent = bodies.current

    return () => {
      for (const t of pending.values()) window.clearTimeout(t)
      pending.clear()
      sent.clear()
    }
  }, [streamId])

  // A dropped connection loses its subscriptions until the next `subscribed`.
  useEffect(
    () =>
      realtime().onStatus((st) => {
        if (st !== 'open') setSubscribed(false)
      }),
    [],
  )

  const onError = useCallback(
    (err: ErrorFrame) => {
      const effect = errorEffect(err.code, err.details)
      if (err.ref && err.ref !== topic) {
        clearTimer(err.ref)
        const body = bodies.current.get(err.ref)
        bodies.current.delete(err.ref)
        // A line refused by auto-mod stays in the list; the input is not refilled with it.
        if (body && !effect.blocked) setReturned({ body, nonce: Date.now() })
        if (effect.login) gated({ type: 'chat', params: { streamId } })
        dispatch({ type: 'rejected', clientMsgId: err.ref, effect })

        return
      }
      // Without ref: a refused subscribe or a room-wide refusal; only locks make sense here.
      if (effect.lock) dispatch({ type: 'rejected', clientMsgId: null, effect: { lock: effect.lock } })
    },
    [clearTimer, gated, streamId, topic],
  )

  useRealtimeTopic(topic, {
    onSubscribed: (snapshot) => {
      setSubscribed(true)
      dispatch({ type: 'snapshot', snapshot: parseChatSnapshot(snapshot), now: Date.now() })
    },
    onEvent: (ev: EventFrame) => {
      const parsed = parseChatEvent(ev.type, ev.data)
      if (parsed) enqueue(parsed)
    },
    onResync: () => void loadHistory(true),
    onError,
  })

  const connection: ConnectionView = endedOnArrival ? 'open' : connectionView(realtimeStatus, subscribed, signedIn)
  const needsClock = state.cooldownUntil !== null || state.lock?.kind === 'timeout'
  const now = useNow(needsClock ? 500 : 60_000)
  const view = composerView({
    signedIn,
    connection,
    roomStatus: state.room?.status ?? null,
    streamEnded: status === 'ENDED',
    lock: state.lock,
    cooldownUntil: state.cooldownUntil,
    now,
  })

  const armAckTimer = useCallback((clientMsgId: string) => {
    clearTimer(clientMsgId)
    timers.current.set(
      clientMsgId,
      window.setTimeout(() => {
        timers.current.delete(clientMsgId)
        dispatch({ type: 'ackTimeout', clientMsgId })
      }, CHAT_LIMITS.ackTimeoutMs),
    )
  }, [clearTimer])

  const send = useCallback(
    (draft: string): boolean => {
      if (view.kind === 'guest') {
        gated({ type: 'chat', params: { streamId } })

        return false
      }
      if (view.kind !== 'ready' || view.cooldownSec > 0 || !me || !topic) return false
      const check = checkDraft(draft)
      if (!check.ok) return false

      const clientMsgId = randomUuid()
      const snapshotMe = state.me
      const message: ChatMessage = {
        id: `local:${clientMsgId}`,
        streamId,
        user: { id: me.id, username: me.username, displayName: user?.displayName || me.username, color: snapshotMe?.color ?? null, badges: snapshotMe?.badges ?? [] },
        body: check.body,
        fragments: localFragments(check.body, byCode),
        type: 'NORMAL',
        createdAt: new Date().toISOString(),
        deleted: false,
        pinned: false,
        clientMsgId,
      }
      const slowSec = exemptFromSlow(snapshotMe?.role) ? 0 : (state.room?.mode.slowSec ?? 0)
      bodies.current.set(clientMsgId, check.body)
      dispatch({ type: 'send', message, clientMsgId, slowSec, now: Date.now() })
      if (realtime().send(topic, 'message', { body: check.body }, clientMsgId)) armAckTimer(clientMsgId)
      else dispatch({ type: 'ackTimeout', clientMsgId })

      return true
    },
    [view, gated, streamId, me, topic, state.me, state.room, user?.displayName, byCode, armAckTimer],
  )

  const retry = useCallback(
    (clientMsgId: string) => {
      const body = bodies.current.get(clientMsgId)
      if (!body || !topic) return
      dispatch({ type: 'retry', clientMsgId })
      // Same clientMsgId: the server drops it if the first attempt did arrive (BR07, E15).
      if (realtime().send(topic, 'message', { body }, clientMsgId)) armAckTimer(clientMsgId)
      else dispatch({ type: 'ackTimeout', clientMsgId })
    },
    [topic, armAckTimer],
  )

  const setPaused = useCallback((paused: boolean) => dispatch({ type: 'scroll', paused }), [])
  const modLost = useCallback(() => dispatch({ type: 'modLost' }), [])
  const clearNotice = useCallback(() => dispatch({ type: 'clearNotice' }), [])
  const reconnect = useCallback(() => {
    realtime().retry()
    if (state.phase === 'error') void loadHistory(false)
  }, [state.phase, loadHistory])

  const chatters = useMemo(() => recentChatters(state.items, me?.id ?? null), [state.items, me?.id])

  return { streamId, channelId, state, connection, view, me, chatters, returned, send, retry, setPaused, clearNotice, reconnect, modLost }
}
