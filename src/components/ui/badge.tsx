import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * 6px radius, label-sm. `live` always carries a dot and text (never colour alone) and is the only
 * place crimson appears besides destructive actions.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-control border border-transparent px-1.5 py-0.5 text-label-sm font-semibold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'border-border bg-surface text-muted-foreground',
        outline: 'border-border text-foreground',
        live: 'bg-live font-bold uppercase text-white',
        cyan: 'bg-cyan text-cyan-foreground',
        success: 'bg-success text-primary-foreground',
        warning: 'bg-warning text-primary-foreground',
        /** Viewer count / duration on top of a thumbnail. */
        overlay: 'bg-black/70 text-foreground backdrop-blur-sm',
        tag: 'border-border bg-surface font-medium text-muted-foreground hover:text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp data-slot="badge" data-variant={variant ?? 'default'} className={cn(badgeVariants({ variant }), className)} {...props}>
      {variant === 'live' && !asChild && <span className="size-1.5 rounded-full bg-white" aria-hidden />}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }
