import { z } from 'zod'

export const TITLE_MAX = 140
export const TAGS_MAX = 10
export const TAG_MAX = 25

/** Values for the validation messages below ("studio:settings.validation.*"). */
export const SETTINGS_LIMITS = { titleMax: TITLE_MAX, tagMax: TAG_MAX, tagsMax: TAGS_MAX }

/** Stream languages offered in Studio (stream-svc stores the code, default "vi"); labels in studio:streamLanguages. */
export const STREAM_LANGUAGES = ['vi', 'en'] as const

/** Mirrors stream-svc validation (PUT /v1/studio/stream). */
export const settingsSchema = z.object({
  title: z.string().trim().min(1, 'studio:settings.validation.titleRequired').max(TITLE_MAX, 'studio:settings.validation.titleMax'),
  tags: z
    .array(z.string().trim().min(1).max(TAG_MAX, 'studio:settings.validation.tagMax'))
    .max(TAGS_MAX, 'studio:settings.validation.tagsMax'),
  language: z.string().min(2).max(8),
  isMature: z.boolean(),
})

export type SettingsForm = z.infer<typeof settingsSchema>

/** "lol, Valorant ,lol" → ["lol", "Valorant"] (trimmed, case-insensitive de-dup). */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const raw of input.split(',')) {
    const tag = raw.trim()
    if (!tag || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    out.push(tag)
  }

  return out
}

/** Adds the comma separated tags in `raw` after `existing`, keeping order and dropping duplicates. */
export function addTags(existing: string[], raw: string): string[] {
  return parseTags([...existing, raw].join(','))
}
