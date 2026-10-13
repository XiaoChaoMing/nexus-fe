import { useTranslation } from 'react-i18next'
import { MessagesSquareIcon, PanelRightCloseIcon, PanelRightOpenIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

/** Empty State "Chat sẽ sớm có mặt" (G2-Q3: the chat column is kept for GĐ3). */
export function ChatComingSoon() {
  const { t } = useTranslation('watch')

  return (
    <Empty className="flex-none" data-testid="chat-placeholder">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessagesSquareIcon />
        </EmptyMedia>
        <EmptyTitle>{t('chat.comingSoon')}</EmptyTitle>
        <EmptyDescription>{t('chat.comingSoonBody')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

/** Desktop chat column (340 px) with a collapse button in its header. */
export function ChatColumn({ onCollapse }: { onCollapse: () => void }) {
  const { t } = useTranslation('watch')

  return (
    <aside
      aria-labelledby="chat-title"
      data-testid="chat-column"
      className="sticky top-21 flex h-[calc(100dvh-7.5rem)] min-h-120 w-85 shrink-0 flex-col rounded-panel border bg-surface"
    >
      <div className="flex h-13 shrink-0 items-center justify-between pr-2 pl-4">
        <h2 id="chat-title" className="text-body-lg font-semibold text-foreground">
          {t('chat.title')}
        </h2>
        <button
          type="button"
          onClick={onCollapse}
          aria-label={t('chat.collapse')}
          title={t('chat.collapse')}
          className="grid size-9 place-items-center rounded-control text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <PanelRightCloseIcon className="size-5" aria-hidden />
        </button>
      </div>
      <div className="grid flex-1 place-items-center p-4">
        <ChatComingSoon />
      </div>
    </aside>
  )
}

/** Collapsed chat: a 44 px "Mở chat" button on the right edge. */
export function ChatRail({ onExpand }: { onExpand: () => void }) {
  const { t } = useTranslation('watch')

  return (
    <div className="sticky top-21 w-11 shrink-0 self-start">
      <button
        type="button"
        onClick={onExpand}
        aria-label={t('chat.expand')}
        title={t('chat.expand')}
        data-testid="chat-expand"
        className="grid size-11 place-items-center rounded-lg border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <PanelRightOpenIcon className="size-5" aria-hidden />
      </button>
    </div>
  )
}
