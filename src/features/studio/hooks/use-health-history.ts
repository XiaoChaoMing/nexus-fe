import { useState } from 'react'
import type { Health } from '@/features/streams/types'
import { appendSample } from '@/features/studio/lib/health'

/** Health reports seen for the current broadcast (polling returns only the latest one). */
export function useHealthHistory(streamId: string | null, health: Health | null): Health[] {
  const [state, setState] = useState<{ streamId: string | null; samples: Health[] }>({ streamId, samples: [] })

  // Adjust state during render: reset on a new broadcast, append when a new report arrives.
  const base = state.streamId === streamId ? state.samples : []
  const next = appendSample(base, health)
  if (state.streamId !== streamId || next !== state.samples) setState({ streamId, samples: next })

  return next
}
