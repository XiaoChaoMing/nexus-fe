import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addTags, TAGS_MAX } from '@/features/studio/schemas/settings-schema'

type TagInputProps = {
  label: string
  value: string[]
  onChange: (tags: string[]) => void
  hint?: string
  error?: string
}

/** Chips + free text: Enter or comma adds, Backspace on an empty field removes the last chip. */
export function TagInput({ label, value, onChange, hint, error }: TagInputProps) {
  const { t } = useTranslation('studio')
  const id = useId()
  const [draft, setDraft] = useState('')

  const commit = (raw: string) => {
    const next = addTags(value, raw)
    if (next.length !== value.length) onChange(next)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground">
          {label}
        </label>
        <span className="text-body-sm text-subtle-foreground tabular-nums">
          {value.length}/{TAGS_MAX}
        </span>
      </div>
      <div
        className={cn(
          'flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-transparent bg-background px-2 py-1.5 focus-within:border-primary',
          error && 'border-destructive',
        )}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-control bg-card py-1 pr-1.5 pl-2 text-label-sm text-foreground">
            {tag}
            <button
              type="button"
              aria-label={t('settings.removeTag', { tag })}
              onClick={() => onChange(value.filter((x) => x !== tag))}
              className="grid size-4 place-items-center rounded-sm text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => (e.target.value.includes(',') ? commit(e.target.value) : setDraft(e.target.value))}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && commit(draft)}
          placeholder={value.length < TAGS_MAX ? t('settings.addTag') : ''}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint`}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-body-sm text-foreground outline-none placeholder:text-subtle-foreground"
        />
      </div>
      <p id={`${id}-hint`} className={cn('text-body-sm', error ? 'text-destructive' : 'text-subtle-foreground')}>
        {error ?? hint}
      </p>
    </div>
  )
}
