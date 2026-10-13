import { apiRequest } from '@/lib/api-client'
import type { ApplicationInput, CreatorApplication } from '@/features/creator/types'

export const creatorApi = {
  /** Latest application of the caller, or null when there is none. */
  mine: () => apiRequest<CreatorApplication | null>('/v1/creator-applications/me', { auth: true }),
  submit: (body: ApplicationInput) => apiRequest<CreatorApplication>('/v1/creator-applications', { method: 'POST', body, auth: true }),
  cancel: (id: string) => apiRequest<void>(`/v1/creator-applications/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
}
