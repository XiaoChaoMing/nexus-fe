import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

type LooseT = (key: string, values?: Record<string, unknown>) => string

/**
 * Translates a key carried as data ("ns:path"), e.g. a zod message or a mapped API error code.
 * Typed `t` only accepts literal keys, so this is the one place that widens it.
 */
export function useMessage() {
  const { t } = useTranslation()

  return useCallback(
    (key: string | undefined, values?: Record<string, unknown>) => (key ? (t as unknown as LooseT)(key, values) : undefined),
    [t],
  )
}
