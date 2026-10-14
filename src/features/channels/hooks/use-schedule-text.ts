import { useTranslation } from 'react-i18next'
import { dayLabel } from '@/features/channels/lib/schedule-days'
import { formatDate } from '@/lib/format'
import { browserTimeZone } from '@/lib/timezone'

/** "2 giờ", "1 giờ 30 phút", "45 phút". */
export function useDurationText() {
  const { t } = useTranslation('channel')

  return (min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    if (h === 0) return t('duration.minutes', { count: m })
    if (m === 0) return t('duration.hours', { count: h })

    return t('duration.hoursMinutes', { h, m })
  }
}

/** "Hôm nay 20:00", "Ngày mai 20:00", "Thứ 6, 17/10 · 20:00" in the viewer's zone. */
export function useWhenText() {
  const { t } = useTranslation('channel')

  return (iso: string, now: number) => {
    const ms = Date.parse(iso)
    const time = formatDate(iso, { hour: '2-digit', minute: '2-digit' })
    const label = dayLabel(ms, now, browserTimeZone())
    if (label.kind === 'today') return t('schedule.todayAt', { time })
    if (label.kind === 'tomorrow') return t('schedule.tomorrowAt', { time })

    return t('schedule.dateAt', { date: formatDate(iso, { weekday: 'long', day: '2-digit', month: '2-digit' }), time })
  }
}
