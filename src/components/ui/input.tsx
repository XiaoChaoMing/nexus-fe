import * as React from 'react'
import { cn } from '@/lib/utils'

/** 40px, Level-1 fill, hairline that turns Electric Pulse on focus (no ring shadow). */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-lg border border-input bg-surface px-3 text-body-md text-foreground transition-colors outline-none',
        'selection:bg-primary selection:text-primary-foreground placeholder:text-subtle-foreground',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        'focus-visible:border-primary focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
