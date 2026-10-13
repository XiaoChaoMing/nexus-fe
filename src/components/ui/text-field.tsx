import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { CircleAlertIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
  /** Adds a show/hide toggle; labels come from the caller so copy stays in feature constants. */
  revealLabels?: { show: string; hide: string }
  endAdornment?: ReactNode
}

/** Label + Input + hint/error, wired for screen readers (aria-describedby, aria-invalid). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, revealLabels, type = 'text', className, ...rest },
  ref,
) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const inputType = revealLabels ? (revealed ? 'text' : 'password') : type

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(revealLabels && 'pr-16')}
          {...rest}
        />
        {revealLabels && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 px-3 text-label-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            {revealed ? revealLabels.hide : revealLabels.show}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-label-sm text-subtle-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1 text-label-sm text-destructive">
          <CircleAlertIcon className="size-3.5" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
})
