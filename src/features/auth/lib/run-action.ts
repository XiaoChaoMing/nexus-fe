import { useUiStore } from '@/stores/ui-store'
import { queryClient } from '@/lib/query-client'
import { followAfterSignIn } from '@/features/channels/lib/follow-cache'
import { remindAfterSignIn } from '@/features/channels/hooks/use-reminder'
import { goLiveTarget } from '@/features/auth/lib/roles'
import { openReportFromParams } from '@/features/moderation/stores/report-store'
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
      if (me && action.params.channelId) void followAfterSignIn(queryClient, me.user.id, action.params.channelId)

      return
    }
    case 'remind': {
      const back = sanitizeReturnTo(action.returnTo, currentPath)
      if (back !== currentPath) navigate(back)
      const { scheduleId, occurrenceAt } = action.params
      if (me && scheduleId && occurrenceAt) void remindAfterSignIn(queryClient, me.user.id, scheduleId, occurrenceAt)

      return
    }
    case 'chat': {
      const back = sanitizeReturnTo(action.returnTo, currentPath)
      if (back !== currentPath) navigate(back)
      useUiStore.getState().requestChatFocus()

      return
    }
    case 'report': {
      const back = sanitizeReturnTo(action.returnTo, currentPath)
      if (back !== currentPath) navigate(back)
      openReportFromParams(action.params)

      return
    }
    case 'navigate': {
      const to = sanitizeReturnTo(action.params.to ?? action.returnTo, currentPath)
      if (to !== currentPath) navigate(to)
    }
  }
}
