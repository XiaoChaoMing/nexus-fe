/**
 * Client-side chat values (NXL-B §6, chốt ở TSD GĐ3 §9 / G3-Q3). Server-side limits (rate, duplicate window,
 * sampling) live in chat-svc; the UI only reflects its answers.
 */
export const CHAT_LIMITS = {
  /** BR03: characters per message. */
  maxChars: 500,
  /** BR03 / Q14: lines per message. */
  maxLines: 3,
  /** §9B: the counter appears from this many characters. */
  counterFrom: 400,
  /** BR23 / Q6: messages kept in the list. */
  domLimit: 150,
  /** BR24 / Q6: history loaded on join and after a resync. */
  historyOnJoin: 50,
  /** BR25 / Q6: messages held while the reader has scrolled up. */
  pausedBufferMax: 500,
  /** Q7: a sent message without `ack` after this long is FAILED. */
  ackTimeoutMs: 5000,
  /** AF03: farther than this from the bottom pauses auto-scroll. */
  pauseThresholdPx: 24,
  /** Brief C0 Mention Suggest: at most this many names. */
  mentionSuggestions: 5,
  /** Recent chatters remembered for @mention. */
  recentChatters: 50,
  /** AF01: "Gần đây" keeps this many emotes. */
  recentEmotes: 20,
} as const

/** BR09: slow mode values (seconds, 0 = off). */
export const SLOW_OPTIONS = [0, 2, 5, 10, 30, 60, 120] as const

/** BR10: Followers-only values (minutes; null = off, 0 = any follower). */
export const FOLLOWERS_OPTIONS = [null, 0, 10, 30, 60, 1440, 10080, 43200, 129600] as const
