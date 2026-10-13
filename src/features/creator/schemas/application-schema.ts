import { z } from 'zod'

const v = {
  legalName: 'creator:validation.legalName',
  birthDate: 'creator:validation.birthDate',
  birthFuture: 'creator:validation.birthFuture',
  underage: 'creator:validation.underage',
  note: 'creator:validation.note',
  terms: 'creator:validation.terms',
} as const

/** NXL-D BR-D12 / §12 `CREATOR_MIN_AGE`; identity has the final word (`422 UNDERAGE`). */
export const CREATOR_MIN_AGE = 18
export const NOTE_MAX = 500

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parses YYYY-MM-DD as a calendar date; null for anything else (2023-02-30 included). */
export function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = DATE.exec(value)
  if (!match) return null
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null

  return { y, m, d }
}

/** Whole years between a birth date and `today` (local calendar). */
export function ageOn(birthDate: string, today = new Date()): number | null {
  const b = parseIsoDate(birthDate)
  if (!b) return null
  const ty = today.getFullYear()
  const tm = today.getMonth() + 1
  const td = today.getDate()

  return ty - b.y - (tm < b.m || (tm === b.m && td < b.d) ? 1 : 0)
}

export function isFutureDate(value: string, today = new Date()): boolean {
  const age = ageOn(value, today)

  return age !== null && (age < 0 || value > toIsoDate(today))
}

export function toIsoDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')

  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function applicationSchema(today = new Date()) {
  return z.object({
    legalName: z.string().trim().min(2, v.legalName).max(100, v.legalName),
    birthDate: z
      .string()
      .refine((x) => parseIsoDate(x) !== null, v.birthDate)
      .refine((x) => !isFutureDate(x, today), v.birthFuture)
      .refine((x) => (ageOn(x, today) ?? 0) >= CREATOR_MIN_AGE, v.underage),
    note: z.string().trim().max(NOTE_MAX, v.note),
    acceptCreatorTerms: z.boolean().refine((x) => x, v.terms),
  })
}

export type ApplicationForm = z.infer<ReturnType<typeof applicationSchema>>
