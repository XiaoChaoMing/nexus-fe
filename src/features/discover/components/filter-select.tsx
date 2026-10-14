import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type Option<V extends string> = { value: V; label: string }

/** Select (Components GĐ4): "Sắp xếp: Nhiều người xem ▾"; the open menu ticks the current option. */
export function FilterSelect<V extends string>({ label, value, options, onChange, testId }: { label: string; value: V; options: Option<V>[]; onChange: (v: V) => void; testId?: string }) {
  const current = options.find((o) => o.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-9 items-center gap-1 rounded-lg border bg-surface pr-2 pl-3 text-[13px] outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:border-primary max-md:h-11"
        data-testid={testId}
      >
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{current?.label}</span>
        <ChevronDownIcon className="size-4.5 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-50 bg-surface">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            role="menuitemradio"
            aria-checked={o.value === value}
            onSelect={() => onChange(o.value)}
            className={cn('h-9 text-[13px] max-md:h-11', o.value === value && 'bg-accent font-semibold')}
          >
            <span className="flex-1">{o.label}</span>
            {o.value === value && <CheckIcon className="size-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Segmented/View: two options, the selected one framed in the brand colour. */
export function Segmented<V extends string>({ label, value, options, onChange, className }: { label: string; value: V; options: (Option<V> & { icon?: React.ComponentType<{ className?: string }> })[]; onChange: (v: V) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex gap-0.5 rounded-control border bg-surface p-0.75', className)}>
      {options.map((o) => {
        const Icon = o.icon
        const on = o.value === value

        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-control px-3.5 text-[13px] whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-ring max-md:h-10',
              on ? 'border border-primary bg-card font-semibold text-foreground' : 'font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="size-4" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Chip/Default · Chip/Selected (6 px radius): the group pills. */
export function Pill({ selected, children, onClick }: { selected: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center rounded-control border px-3 text-[13px] whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-ring max-md:h-9',
        selected ? 'border-primary bg-card font-semibold text-foreground' : 'bg-surface font-medium text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
