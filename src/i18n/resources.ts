import enAccount from '@/locales/en/account.json'
import enAuth from '@/locales/en/auth.json'
import enChannel from '@/locales/en/channel.json'
import enChat from '@/locales/en/chat.json'
import enCommon from '@/locales/en/common.json'
import enCreator from '@/locales/en/creator.json'
import enDiscover from '@/locales/en/discover.json'
import enHome from '@/locales/en/home.json'
import enModeration from '@/locales/en/moderation.json'
import enNotifications from '@/locales/en/notifications.json'
import enPlayer from '@/locales/en/player.json'
import enSearch from '@/locales/en/search.json'
import enStudio from '@/locales/en/studio.json'
import enSystem from '@/locales/en/system.json'
import enVod from '@/locales/en/vod.json'
import enWatch from '@/locales/en/watch.json'
import viAccount from '@/locales/vi/account.json'
import viAuth from '@/locales/vi/auth.json'
import viChannel from '@/locales/vi/channel.json'
import viChat from '@/locales/vi/chat.json'
import viCommon from '@/locales/vi/common.json'
import viCreator from '@/locales/vi/creator.json'
import viDiscover from '@/locales/vi/discover.json'
import viHome from '@/locales/vi/home.json'
import viModeration from '@/locales/vi/moderation.json'
import viNotifications from '@/locales/vi/notifications.json'
import viPlayer from '@/locales/vi/player.json'
import viSearch from '@/locales/vi/search.json'
import viStudio from '@/locales/vi/studio.json'
import viSystem from '@/locales/vi/system.json'
import viVod from '@/locales/vi/vod.json'
import viWatch from '@/locales/vi/watch.json'

export const SUPPORTED_LANGUAGES = ['vi', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'vi'

export const NAMESPACES = ['common', 'auth', 'account', 'creator', 'system', 'home', 'watch', 'player', 'studio', 'vod', 'chat', 'channel', 'discover', 'search', 'notifications', 'moderation'] as const
export const DEFAULT_NS = 'common'

/** Vietnamese is the source language: its files define the keys every other language must have. */
export const resources = {
  vi: {
    common: viCommon,
    auth: viAuth,
    account: viAccount,
    creator: viCreator,
    system: viSystem,
    home: viHome,
    watch: viWatch,
    player: viPlayer,
    studio: viStudio,
    vod: viVod,
    chat: viChat,
    channel: viChannel,
    discover: viDiscover,
    search: viSearch,
    notifications: viNotifications,
    moderation: viModeration,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    account: enAccount,
    creator: enCreator,
    system: enSystem,
    home: enHome,
    watch: enWatch,
    player: enPlayer,
    studio: enStudio,
    vod: enVod,
    chat: enChat,
    channel: enChannel,
    discover: enDiscover,
    search: enSearch,
    notifications: enNotifications,
    moderation: enModeration,
  },
} as const
