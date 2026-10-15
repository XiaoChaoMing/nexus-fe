import { useCallback } from 'react'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { reportParams } from '@/features/moderation/stores/report-store'
import type { ReportTarget } from '@/features/moderation/types'

/** Opens the report modal, or the sign-in modal first for guests ("Đăng nhập để báo cáo"). */
export function useReport() {
  const gated = useGatedAction()

  return useCallback((target: ReportTarget) => gated({ type: 'report', params: reportParams(target), context: 'report' }), [gated])
}
