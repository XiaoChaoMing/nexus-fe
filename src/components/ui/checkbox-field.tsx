import { useId, type ReactNode } from 'react'
import { CircleAlertIcon } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

type CheckboxFieldProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: ReactNode
  error?: string
  name?: string
  className?: string
}

/** Checkbox + label + error, wired for screen readers like TextField. */
export function CheckboxField({ checked, onCheckedChange, label, error, name, className }: CheckboxFieldProps) {
  const id = useId()

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          name={name}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5"
        />
        <label htmlFor={id} className="text-body-sm leading-5 text-muted-foreground">
          {label}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1 text-label-sm text-destructive">
          <CircleAlertIcon className="size-3.5" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
