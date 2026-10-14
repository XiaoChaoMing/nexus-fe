import { toast } from 'sonner'
import i18n from '@/i18n'
import { useUiStore } from '@/stores/ui-store'
import { recordFollowIntent } from '@/features/channels/lib/follow-intent'
import { goLiveTarget } from '@/features/auth/lib/roles'
import { sanitizeReturnTo, type PendingAction } from '@/features/auth/lib/pending-action'
import type { Me } from '@/features/auth/types'

type Ctx = {
  me: Me | null
  /** Current path + search, to avoid a pointless navigation. */
  currentPath: string
  navigate: (to: string) => void
}

/** Performs a gated action for a signed-in user (directly, or after sign-in via the pending-action runner). */
export function runAction(action: Pick<PendingAction, 'type' | 'params' | 'returnTo'>, { me, currentPath, navigate }: Ctx) {
  switch (action.type) {
    case 'goLive':
    case 'becomeCreator': {
      const target = goLiveTarget(me)
      if (target !== 'login' && target !== currentPath) navigate(target)

      return
    }
    case 'follow': {
      // Stay on (or return to) the page the follow was clicked on: the player keeps playing there.
      const back = sanitizeReturnTo(action.returnTo, currentPath)
      if (back !== currentPath) navigate(back)
      recordFollowIntent(action.params.channelId ?? '')
      toast.info(i18n.t('auth:pending.followSoon', { name: action.params.channelName || i18n.t('auth:pending.thisChannel') }))

      return
    }
    case 'chat': {
      const back = sanitizeReturnTo(action.returnTo, currentPath)
      if (back !== currentPath) navigate(back)
      useUiStore.getState().requestChatFocus()

      return
    }
    case 'navigate': {
      const to = sanitizeReturnTo(action.params.to ?? action.returnTo, currentPath)
      if (to !== currentPath) navigate(to)
    }
  }
}
