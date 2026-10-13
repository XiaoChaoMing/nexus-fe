import { toast } from 'sonner'
import i18n from '@/i18n'
import { isApiError } from '@/lib/api-error'
import { retryAfterOf } from '@/lib/error-messages'

/** NXL-00 §13: one toast "Bạn thao tác quá nhanh, thử lại sau N giây" for any 429, deduplicated. */
export function notifyRateLimited(seconds: number) {
  toast.warning(i18n.t('common:errors.rateLimitedWait', { count: seconds }), { id: 'rate-limited' })
}

/** Global handler for query/mutation errors: only the cross-cutting cases, screens handle the rest. */
export function handleGlobalApiError(err: unknown) {
  if (isApiError(err) && err.status === 429) notifyRateLimited(retryAfterOf(err))
}
