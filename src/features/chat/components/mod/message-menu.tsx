import { useRef, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { BanIcon, ChevronRightIcon, EllipsisIcon, EyeIcon, EyeOffIcon, FlagIcon, PinIcon, PinOffIcon, TimerIcon, Trash2Icon, UserCheckIcon, UserXIcon, type LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useMessageMenu } from '@/features/chat/components/mod/use-message-menu'
import type { ChatMessage } from '@/features/chat/types'
import { TIMEOUT_PRESETS } from '@/features/moderation/lib/duration'
import type { MessageAction } from '@/features/moderation/lib/permissions'
import { cn } from '@/lib/utils'

const ICON: Record<MessageAction, LucideIcon> = {
  delete: Trash2Icon,
  timeout: TimerIcon,
  ban: BanIcon,
  pin: PinIcon,
  unpin: PinOffIcon,
  report: FlagIcon,
  block: UserXIcon,
  unblock: UserCheckIcon,
  mute: EyeOffIcon,
  unmute: EyeIcon,
}

function ItemContent({ action, label, danger }: { action: MessageAction; label: string; danger?: boolean }) {
  const Icon = ICON[action]

  return (
    <>
      <Icon className={cn('size-4.5', danger && 'text-destructive')} aria-hidden />
      <span className={cn('flex-1 text-[13px] font-medium', danger ? 'text-destructive' : 'text-foreground')}>{label}</span>
    </>
  )
}

/** Hover "⋯" (24 px, desktop) with Menu/Chat Message; Timeout opens Menu/Timeout to the left. */
export function MessageMenuButton({ message, className }: { message: ChatMessage; className?: string }) {
  const { t } = useTranslation('moderation')
  const { items, label, run, user, timeout } = useMessageMenu(message)
  const trigger = useRef<HTMLButtonElement>(null)
  if (items.mod.length + items.personal.length === 0) return null

  const entry = (a: MessageAction) => {
    if (a === 'timeout') {
      return (
        <DropdownMenuSub key={a}>
          <DropdownMenuSubTrigger className="h-9 gap-2.5 px-2.5" data-testid="menu-timeout">
            <ItemContent action={a} label={label(a)} />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-45">
            {TIMEOUT_PRESETS.map((p) => (
              <DropdownMenuItem key={p.sec} className="h-9 px-2.5 text-[13px] font-medium" onSelect={() => timeout(p.sec)} data-testid={`timeout-${p.sec}`}>
                {t(p.label)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="h-9 px-2.5 text-[13px] font-medium" onSelect={() => run('timeout', trigger.current)}>
              {t('timeout.custom')}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }

    return (
      <DropdownMenuItem key={a} className="h-9 gap-2.5 px-2.5" onSelect={() => run(a)} data-testid={`menu-${a}`}>
        <ItemContent action={a} label={label(a)} danger={a === 'ban'} />
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          ref={trigger}
          type="button"
          aria-label={t('menu.options', { username: user.username })}
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-control border bg-card text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:visible',
            className,
          )}
          data-testid="message-more"
        >
          <EllipsisIcon className="size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={8} className="w-55 bg-surface p-1.5" data-testid="message-menu">
        {items.mod.map(entry)}
        {items.mod.length > 0 && items.personal.length > 0 && <DropdownMenuSeparator />}
        {items.personal.map(entry)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SheetRow({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
      {children}
    </button>
  )
}

/** Mobile: a 400 ms press on a line opens the same items as a bottom sheet (rows ≥ 44 px). */
export function MessageActionsSheet({ message, anchor, onClose }: { message: ChatMessage; anchor: RefObject<Element | null>; onClose: () => void }) {
  const { t } = useTranslation('moderation')
  const { items, label, run, user, timeout } = useMessageMenu(message)
  const all = [...items.mod, ...items.personal]

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" showCloseButton={false} className="gap-1 rounded-t-xl px-2 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" data-testid="message-sheet">
        <SheetTitle className="px-3 pb-1 text-body-md font-semibold">{t('menu.options', { username: user.username })}</SheetTitle>
        <SheetDescription className="sr-only">{message.body}</SheetDescription>
        {all.map((a) =>
          a === 'timeout' ? (
            <div key={a} className="flex flex-col">
              {TIMEOUT_PRESETS.map((p) => (
                <SheetRow
                  key={p.sec}
                  onClick={() => {
                    onClose()
                    timeout(p.sec)
                  }}
                >
                  <ItemContent action="timeout" label={`${label('timeout')} · ${t(p.label)}`} />
                </SheetRow>
              ))}
              <SheetRow
                onClick={() => {
                  onClose()
                  run('timeout', anchor.current)
                }}
              >
                <ItemContent action="timeout" label={`${label('timeout')} · ${t('timeout.custom')}`} />
                <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
              </SheetRow>
            </div>
          ) : (
            <SheetRow
              key={a}
              onClick={() => {
                onClose()
                run(a)
              }}
            >
              <ItemContent action={a} label={label(a)} danger={a === 'ban'} />
            </SheetRow>
          ),
        )}
      </SheetContent>
    </Sheet>
  )
}
