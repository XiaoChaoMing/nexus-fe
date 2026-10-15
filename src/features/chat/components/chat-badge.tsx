import { useTranslation } from 'react-i18next'
import { BadgeCheckIcon, GemIcon, SparklesIcon, StarIcon, SwordsIcon, VideoIcon, type LucideIcon } from 'lucide-react'
import type { ChatBadge } from '@/features/chat/types'
import { cn } from '@/lib/utils'

/** Chat/Badge (Components GĐ3 · Chat): 16 px, radius 4, filled; Verified is the bare icon. */
const BADGE_ICON: Record<ChatBadge, { icon: LucideIcon; className: string; iconClass?: string }> = {
  STREAMER: { icon: VideoIcon, className: 'bg-live text-white' },
  MODERATOR: { icon: SwordsIcon, className: 'bg-success text-primary-foreground' },
  VIP: { icon: GemIcon, className: 'bg-warning text-primary-foreground' },
  SUB_T1: { icon: StarIcon, className: 'bg-primary/12 text-primary' },
  SUB_T2: { icon: StarIcon, className: 'bg-primary text-primary-foreground' },
  SUB_T3: { icon: SparklesIcon, className: 'bg-primary text-primary-foreground' },
  VERIFIED: { icon: BadgeCheckIcon, className: 'text-cyan', iconClass: 'size-4' },
}

/** Chat/Badge: icon only, its name as tooltip and for screen readers (BR15). */
export function ChatBadgeIcon({ badge }: { badge: ChatBadge }) {
  const { t } = useTranslation('chat')
  const { icon: Icon, className, iconClass } = BADGE_ICON[badge]
  const label = t(`badge.${badge}`)

  return (
    <span role="img" aria-label={label} title={label} className={cn('grid size-4 shrink-0 place-items-center rounded-sm', className)}>
      <Icon className={iconClass ?? 'size-3'} strokeWidth={2.5} aria-hidden />
    </span>
  )
}

