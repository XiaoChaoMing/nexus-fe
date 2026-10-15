import { create } from 'zustand'
import type { ReportTarget } from '@/features/moderation/types'

/** The one report modal of the app (Modal/Report): opened from chat, the user card, the watch page, a profile. */
type ReportState = {
  target: ReportTarget | null
  open: (target: ReportTarget) => void
  close: () => void
}

export const useReportModal = create<ReportState>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}))

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** A target remembered across the sign-in modal (pending action params are strings). */
export function parseReportTarget(raw: string | undefined): ReportTarget | null {
  if (!raw) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (!isRec(v) || typeof v.id !== 'string' || !v.id) return null
    switch (v.type) {
      case 'MESSAGE':
        return typeof v.streamId === 'string' && isRec(v.author) ? (v as ReportTarget) : null
      case 'USER':
      case 'STREAM':
      case 'CHANNEL':
        return v as ReportTarget
      default:
        return null
    }
  } catch {
    return null
  }
}

export function reportParams(target: ReportTarget): Record<string, string> {
  return { target: JSON.stringify(target) }
}

/** Pending action "report" after sign-in. */
export function openReportFromParams(params: Record<string, string>) {
  const target = parseReportTarget(params.target)
  if (target) useReportModal.getState().open(target)
}
