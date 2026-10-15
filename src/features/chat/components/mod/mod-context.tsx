import { useCallback, useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BanIcon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { ChatModContext, type Anchor, type ChatModContextValue } from '@/features/chat/components/mod/context'
import { TimeoutCustomPopover } from '@/features/chat/components/mod/timeout-custom'
import { UserCardLayer } from '@/features/chat/components/mod/user-card'
import { useChatModeration, type ChatModeration, type ModTarget } from '@/features/chat/hooks/use-chat-moderation'
import type { ChatRoom } from '@/features/chat/hooks/use-chat-room'
import type { ChatMessage } from '@/features/chat/types'
import { useReport } from '@/features/moderation/hooks/use-report'
import { useBlockActions, useBlockedIds, useMuted } from '@/features/moderation/hooks/use-blocks'

/** Modal/Confirm Danger "Cấm @x chat trong kênh này?" with an optional reason (only Ban asks first). */
function BanDialog({ user, onClose, mod }: { user: ModTarget | null; onClose: () => void; mod: ChatModeration }) {
  const { t } = useTranslation(['moderation', 'common'])
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const id = useId()
  const close = () => {
    if (pending) return
    setReason('')
    onClose()
  }

  return (
    <AlertDialog open={user !== null} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent className="gap-4 bg-surface sm:max-w-110" data-testid="ban-dialog">
        <AlertDialogHeader className="flex-row items-center gap-3 text-left">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive/15 text-destructive" aria-hidden>
            <BanIcon className="size-5" />
          </span>
          <AlertDialogTitle className="text-lg leading-6.25">{t('ban.title', { username: user?.username ?? '' })}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription className="text-body-md text-muted-foreground">{t('ban.body', { username: user?.username ?? '' })}</AlertDialogDescription>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-[13px] font-medium text-foreground">
            {t('ban.reason')}
          </label>
          <Input id={id} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder={t('ban.reasonPlaceholder')} className="bg-background" disabled={pending} />
        </div>
        <AlertDialogFooter className="pt-2">
          <AlertDialogCancel variant="secondary" className="font-medium" disabled={pending}>
            {t('common:actions.cancel')}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            className="text-primary-foreground"
            loading={pending}
            data-testid="ban-confirm"
            onClick={() => {
              if (!user) return
              setPending(true)
              void mod.ban(user, reason.trim() || undefined).then((done) => {
                setPending(false)
                if (done) {
                  setReason('')
                  onClose()
                }
              })
            }}
          >
            {t('ban.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Everything a chat line may open — the user card, Ban / Block confirmations, the custom timeout — lives once per
 * chat panel, with the room's moderation calls and the viewer's block / mute lists.
 */
export function ChatModProvider({ room, children }: { room: ChatRoom; children: ReactNode }) {
  const { t } = useTranslation('moderation')
  const mod = useChatModeration(room)
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const blocked = useBlockedIds()
  const { ids: muted, toggle } = useMuted()
  const { block, unblock } = useBlockActions()
  const gated = useGatedAction()
  const report = useReport()
  const [card, setCard] = useState<{ user: ModTarget & { displayName: string }; anchor: Anchor } | null>(null)
  const [ban, setBan] = useState<ModTarget | null>(null)
  const [blockTarget, setBlockTarget] = useState<ModTarget | null>(null)
  const [custom, setCustom] = useState<{ user: ModTarget; anchor: Anchor } | null>(null)

  const me = room.state.me
  const canModerate = signedIn && Boolean(me?.canModerate)
  const pinnedId = room.state.room?.pinned?.id ?? null

  const toggleMute = useCallback(
    (u: ModTarget) => {
      const nowMuted = toggle(u.id)
      toast.success(t(nowMuted ? 'toast.muted' : 'toast.unmuted', { username: u.username }), { duration: 4000 })
    },
    [toggle, t],
  )

  const reportMessage = useCallback(
    (m: ChatMessage) =>
      report({
        type: 'MESSAGE',
        id: m.id,
        streamId: room.streamId,
        author: { id: m.user.id, username: m.user.username, displayName: m.user.displayName, color: m.user.color, badges: m.user.badges },
        body: m.body,
      }),
    [report, room.streamId],
  )

  const value = useMemo<ChatModContextValue>(
    () => ({
      streamId: room.streamId,
      channelId: room.channelId,
      mod,
      canModerate,
      myRole: me?.role,
      myId: room.me?.id ?? null,
      pinnedId,
      blocked,
      muted,
      openCard: (user, anchor) => setCard({ user, anchor }),
      askBan: setBan,
      askBlock: (u) => (signedIn ? setBlockTarget(u) : gated({ type: 'chat', params: { streamId: room.streamId } })),
      unblock: (u) => unblock.mutate({ id: u.id, username: u.username }),
      customTimeout: (user, anchor) => setCustom({ user, anchor }),
      toggleMute,
      report,
      reportMessage,
    }),
    [room.streamId, room.channelId, room.me?.id, mod, canModerate, me?.role, pinnedId, blocked, muted, signedIn, gated, unblock, toggleMute, report, reportMessage],
  )

  return (
    <ChatModContext.Provider value={value}>
      {children}
      {card && <UserCardLayer key={card.user.id} user={card.user} anchor={card.anchor} onClose={() => setCard(null)} />}
      <BanDialog user={ban} onClose={() => setBan(null)} mod={mod} />
      <ConfirmDialog
        open={blockTarget !== null}
        title={t('block.title', { username: blockTarget?.username ?? '' })}
        confirmLabel={t('block.confirm')}
        danger
        loading={block.isPending}
        onClose={() => setBlockTarget(null)}
        onConfirm={() => {
          if (!blockTarget) return
          block.mutate({ id: blockTarget.id, username: blockTarget.username }, { onSettled: () => setBlockTarget(null) })
        }}
      >
        {t('block.body', { username: blockTarget?.username ?? '' })}
      </ConfirmDialog>
      {custom && <TimeoutCustomPopover key={custom.user.id} user={custom.user} anchor={custom.anchor} onClose={() => setCustom(null)} />}
    </ChatModContext.Provider>
  )
}
