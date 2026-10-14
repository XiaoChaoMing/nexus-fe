import { useCallback } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { channelsApi } from '@/features/channels/api/channels-api'
import { errorCode } from '@/lib/api-error'
import { formatDate } from '@/lib/format'

/**
 * "Đặt nhắc" for one broadcast (NXL-D BR-D22): saved at once and confirmed with a toast; GĐ4 only stores the
 * choice (the reminder itself is sent from GĐ5).
 */
export const reminderKeys = {
  one: (viewer: string, scheduleId: string, occurrenceAt: string) => ['reminder', viewer, scheduleId, occurrenceAt] as const,
}

const timeOf = (iso: string) => formatDate(iso, { hour: '2-digit', minute: '2-digit' })

async function toggle(qc: QueryClient, viewer: string, scheduleId: string, occurrenceAt: string, on: boolean) {
  const key = reminderKeys.one(viewer, scheduleId, occurrenceAt)
  const before = qc.getQueryData<boolean>(key)
  qc.setQueryData(key, on)
  try {
    if (on) await channelsApi.remind(scheduleId, occurrenceAt)
    else await channelsApi.unremind(scheduleId, occurrenceAt)
    toast.success(on ? i18n.t('channel:schedule.reminderSet', { time: timeOf(occurrenceAt) }) : i18n.t('channel:schedule.reminderRemoved'))
  } catch (err) {
    qc.setQueryData(key, before)
    const code = errorCode(err)
    toast.error(code === 'INVALID_STATE' || code === 'NOT_FOUND' ? i18n.t('channel:schedule.reminderClosed') : i18n.t('channel:schedule.reminderFailed'))
  }
}

/** Reminder set by a guest, finished after sign-in. */
export function remindAfterSignIn(qc: QueryClient, viewer: string, scheduleId: string, occurrenceAt: string) {
  return toggle(qc, viewer, scheduleId, occurrenceAt, true)
}

/** `seed`: `Occurrence.reminded` when the page has it; otherwise the channel schedule around the broadcast is read. */
export function useReminder(o: { scheduleId: string; occurrenceAt: string; channelId?: string }, seed?: boolean | null) {
  const qc = useQueryClient()
  const viewer = useAuthStore((s) => s.user?.id ?? null)
  const query = useQuery({
    queryKey: reminderKeys.one(viewer ?? 'guest', o.scheduleId, o.occurrenceAt),
    queryFn: async () => {
      if (!o.channelId) return false
      const at = Date.parse(o.occurrenceAt)
      const { items } = await channelsApi.schedule(o.channelId, {
        from: new Date(at - 60_000).toISOString(),
        to: new Date(at + 60_000).toISOString(),
      })

      return items.some((i) => i.scheduleId === o.scheduleId && Date.parse(i.occurrenceAt) === at && i.reminded === true)
    },
    enabled: viewer !== null && Boolean(o.scheduleId && o.occurrenceAt),
    initialData: seed ?? undefined,
    staleTime: 60_000,
  })

  return {
    reminded: query.data === true,
    toggle: useCallback(() => {
      if (viewer) void toggle(qc, viewer, o.scheduleId, o.occurrenceAt, query.data !== true)
    }, [qc, viewer, o.scheduleId, o.occurrenceAt, query.data]),
  }
}
