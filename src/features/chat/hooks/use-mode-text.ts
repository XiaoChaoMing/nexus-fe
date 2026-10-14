import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMode } from '@/features/chat/types'

type DurationKey = 'm10' | 'm30' | 'h1' | 'd1' | 'w1' | 'mo1' | 'mo3'

const DURATIONS: Record<number, DurationKey> = { 10: 'm10', 30: 'm30', 60: 'h1', 1440: 'd1', 10080: 'w1', 43200: 'mo1', 129600: 'mo3' }

/** Labels for chat modes (Mode bar, system notices, settings, toasts) in the viewer's language. */
export function useModeText() {
  const { t } = useTranslation('chat')

  return useMemo(() => {
    const duration = (min: number) => {
      const key = DURATIONS[min]

      return key ? t(`duration.${key}`) : t('duration.minutes', { count: min })
    }

    /** Brief C0 Chat/Mode Bar: "Chậm 10 giây" · "Chỉ người theo dõi (10 phút)" · "Chỉ Subscriber". */
    const chips = (mode: ChatMode): string[] => {
      const out: string[] = []
      if (mode.slowSec > 0) out.push(t('mode.slow', { count: mode.slowSec }))
      if (mode.followersMin !== null) out.push(mode.followersMin === 0 ? t('mode.followersAny') : t('mode.followers', { duration: duration(mode.followersMin) }))
      if (mode.subsOnly) out.push(t('mode.subs'))

      return out
    }

    /** Mode Bar entries with their kind (for the icon). */
    const items = (mode: ChatMode): { kind: 'slow' | 'followers' | 'subs'; label: string }[] => {
      const out: { kind: 'slow' | 'followers' | 'subs'; label: string }[] = []
      if (mode.slowSec > 0) out.push({ kind: 'slow', label: t('mode.slow', { count: mode.slowSec }) })
      if (mode.followersMin !== null) out.push({ kind: 'followers', label: mode.followersMin === 0 ? t('mode.followersAny') : t('mode.followers', { duration: duration(mode.followersMin) }) })
      if (mode.subsOnly) out.push({ kind: 'subs', label: t('mode.subs') })

      return out
    }

    /** AF05 system notice: what changed ("Chế độ chậm đã bật: 10 giây"). */
    const changes = (mode: ChatMode, prev: ChatMode | null): string[] => {
      const p = prev ?? { slowSec: 0, followersMin: null, subsOnly: false }
      const out: string[] = []
      if (mode.slowSec !== p.slowSec) out.push(mode.slowSec > 0 ? t('notice.slowOn', { count: mode.slowSec }) : t('notice.slowOff'))
      if (mode.followersMin !== p.followersMin) {
        if (mode.followersMin === null) out.push(t('notice.followersOff'))
        else if (mode.followersMin === 0) out.push(t('notice.followersOnAny'))
        else out.push(t('notice.followersOn', { duration: duration(mode.followersMin) }))
      }
      if (mode.subsOnly !== p.subsOnly) out.push(mode.subsOnly ? t('notice.subsOn') : t('notice.subsOff'))

      return out
    }

    /** Toast for the person who changed it (C4: "Đã bật chế độ chậm 10 giây"). */
    const toasts = (mode: ChatMode, prev: ChatMode): string[] => {
      const out: string[] = []
      if (mode.slowSec !== prev.slowSec) out.push(mode.slowSec > 0 ? t('settings.toast.slowOn', { count: mode.slowSec }) : t('settings.toast.slowOff'))
      if (mode.followersMin !== prev.followersMin) {
        if (mode.followersMin === null) out.push(t('settings.toast.followersOff'))
        else if (mode.followersMin === 0) out.push(t('settings.toast.followersOnAny'))
        else out.push(t('settings.toast.followersOn', { duration: duration(mode.followersMin) }))
      }
      if (mode.subsOnly !== prev.subsOnly) out.push(mode.subsOnly ? t('settings.toast.subsOn') : t('settings.toast.subsOff'))

      return out
    }

    return { duration, chips, items, changes, toasts }
  }, [t])
}
