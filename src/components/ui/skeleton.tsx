import { cn } from "@/lib/utils"

/** Loading placeholder: elevated surface, gentle 1.2 s opacity pulse (GĐ2 Skeleton). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-skeleton rounded-lg bg-card", className)}
      {...props}
    />
  )
}

/** Skeleton/Card Stream: 16:9 thumbnail, avatar, two lines and two tag pills. */
function SkeletonStreamCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)} aria-hidden>
      <Skeleton className="aspect-video w-full rounded-lg" />
      <div className="flex gap-2.5">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2 pt-0.5">
          <Skeleton className="h-3.5 w-full rounded-sm" />
          <Skeleton className="h-3 w-30 rounded-sm" />
          <div className="flex gap-1.5">
            <Skeleton className="h-4.5 w-14 rounded-control" />
            <Skeleton className="h-4.5 w-16 rounded-control" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Skeleton/Card Continue: framed card with a thumbnail and three text lines. */
function SkeletonContinueCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border bg-surface", className)} aria-hidden>
      <Skeleton className="h-40 rounded-none" />
      <div className="flex flex-col gap-2 px-3.5 pt-3.5 pb-4">
        <Skeleton className="h-2.5 w-28 rounded-sm" />
        <Skeleton className="h-3.5 w-full rounded-sm" />
        <Skeleton className="h-3 w-35 rounded-sm" />
      </div>
    </div>
  )
}

export { Skeleton, SkeletonStreamCard, SkeletonContinueCard }
