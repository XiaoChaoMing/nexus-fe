import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Full-width strip under the top bar (Banner/Info, Banner/Warning): tinted fill, icon, text, optional action. */
const bannerVariants = cva(
  "flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-body-md text-foreground [&>svg]:size-5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        info: "bg-cyan/15 [&>svg]:text-cyan",
        warning: "bg-warning/15 [&>svg]:text-warning",
      },
    },
    defaultVariants: { variant: "info" },
  }
)

type BannerProps = React.ComponentProps<"div"> &
  VariantProps<typeof bannerVariants> & {
    icon?: React.ReactNode
    action?: React.ReactNode
    onDismiss?: () => void
    dismissLabel?: string
  }

function Banner({ className, variant, icon, action, onDismiss, dismissLabel, children, ...props }: BannerProps) {
  return (
    <div data-slot="banner" data-variant={variant ?? "info"} className={cn(bannerVariants({ variant }), className)} {...props}>
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="grid size-7 shrink-0 place-items-center rounded-control text-muted-foreground hover:bg-accent hover:text-foreground max-md:size-11"
        >
          <XIcon className="size-4.5" aria-hidden />
        </button>
      )}
    </div>
  )
}

/** Text action inside a banner ("Gửi lại"): colour follows the banner variant. */
function BannerAction({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-control px-2 py-1.5 text-label-md font-semibold text-cyan hover:bg-accent disabled:pointer-events-none disabled:opacity-50 max-md:min-h-11",
        className
      )}
      {...props}
    />
  )
}

export { Banner, BannerAction, bannerVariants }
