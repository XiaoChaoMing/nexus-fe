import { z } from 'zod'
import { SUPPORTED_LANGUAGES } from '@/i18n/resources'
import { isFutureDate, parseIsoDate } from '@/features/creator/schemas/application-schema'

const v = {
  displayName: 'account:validation.displayName',
  birthDate: 'account:validation.birthDate',
  timezone: 'account:validation.timezone',
} as const

/** Whether the runtime knows an IANA zone name (identity validates the same way). */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })

    return true
  } catch {
    return false
  }
}

/** `PATCH /v1/me` rules (TSD §4.1): displayName 1–50, locale vi|en, IANA timezone, birthDate optional. */
export function profileSchema(today = new Date()) {
  return z.object({
    displayName: z.string().trim().min(1, v.displayName).max(50, v.displayName),
    birthDate: z
      .string()
      .refine((x) => x === '' || (parseIsoDate(x) !== null && !isFutureDate(x, today)), v.birthDate),
    locale: z.enum(SUPPORTED_LANGUAGES),
    timezone: z.string().refine(isValidTimeZone, v.timezone),
  })
}

export type ProfileForm = z.infer<ReturnType<typeof profileSchema>>
