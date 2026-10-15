import { useTranslation } from 'react-i18next'
import { EllipsisIcon, FlagIcon } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useReport } from '@/features/moderation/hooks/use-report'
import type { ReportTarget } from '@/features/moderation/types'
import { cn } from '@/lib/utils'

/**
 * Menu/Overflow "⋯" next to Follow / Share: "Báo cáo buổi phát" on the watch page, "Báo cáo kênh" on a profile.
 * Not rendered for the viewer's own channel (you cannot report yourself).
 */
export function ReportMenu({ target, channelId, className }: { target: ReportTarget; channelId: string; className?: string }) {
  const { t } = useTranslation('moderation')
  const ownChannel = useAuthStore((s) => s.me?.channelId ?? null)
  const report = useReport()
  if (ownChannel !== null && ownChannel === channelId) return null

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('report.more')}
          title={t('report.more')}
          data-testid="report-more"
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-lg border bg-card text-foreground outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-accent max-md:size-11',
            className,
          )}
        >
          <EllipsisIcon className="size-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-55 bg-surface p-1.5">
        <DropdownMenuItem className="h-9 gap-2.5 px-2.5 text-[13px] font-medium" onSelect={() => report(target)} data-testid="report-open">
          <FlagIcon className="size-4.5" aria-hidden />
          {target.type === 'STREAM' ? t('report.reportStream') : t('report.reportChannel')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
