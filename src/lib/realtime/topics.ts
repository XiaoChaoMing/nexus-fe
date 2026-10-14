import type { ClientFrame } from '@/lib/realtime/protocol'

/**
 * Bookkeeping per topic: how many listeners want it, the last `seq` seen (resume, NXL-00 §10.3) and whether the
 * current connection has subscribed. Pure: no socket, so it is tested on its own.
 */
type TopicEntry<L> = {
  listeners: Set<L>
  lastSeq: number | null
  /** A `subscribe` was sent on this connection (cleared on reconnect). */
  active: boolean
}

export class TopicRegistry<L> {
  private readonly topics = new Map<string, TopicEntry<L>>()

  /** Adds a listener; true when this is the first one (the topic must be subscribed). */
  add(topic: string, listener: L): boolean {
    let entry = this.topics.get(topic)
    const first = !entry || entry.listeners.size === 0
    if (!entry) {
      entry = { listeners: new Set(), lastSeq: null, active: false }
      this.topics.set(topic, entry)
    }
    entry.listeners.add(listener)

    return first
  }

  /** Removes a listener; true when it was the last one (the topic must be unsubscribed and forgotten). */
  remove(topic: string, listener: L): boolean {
    const entry = this.topics.get(topic)
    if (!entry || !entry.listeners.delete(listener)) return false
    if (entry.listeners.size > 0) return false
    this.topics.delete(topic)

    return true
  }

  listeners(topic: string): L[] {
    return [...(this.topics.get(topic)?.listeners ?? [])]
  }

  allListeners(): L[] {
    return [...this.topics.values()].flatMap((e) => [...e.listeners])
  }

  has(topic: string): boolean {
    return this.topics.has(topic)
  }

  get size(): number {
    return this.topics.size
  }

  lastSeq(topic: string): number | null {
    return this.topics.get(topic)?.lastSeq ?? null
  }

  /** The `subscribe` frame for a topic: with `lastSeq` when something was already seen (resume). */
  subscribeFrame(topic: string): ClientFrame {
    const lastSeq = this.lastSeq(topic)

    return lastSeq === null ? { op: 'subscribe', topic } : { op: 'subscribe', topic, lastSeq }
  }

  markActive(topic: string) {
    const entry = this.topics.get(topic)
    if (entry) entry.active = true
  }

  isActive(topic: string): boolean {
    return this.topics.get(topic)?.active ?? false
  }

  /** A new connection: nothing is subscribed on it yet; `lastSeq` is kept for the resume. */
  resetActive() {
    for (const e of this.topics.values()) e.active = false
  }

  /** Topics to subscribe on a fresh connection, each with its resume point. */
  resubscribeFrames(): ClientFrame[] {
    return [...this.topics.keys()].map((t) => this.subscribeFrame(t))
  }

  /**
   * `subscribed` answer. A fresh subscription starts counting from the server's `seq`; a resumed one keeps its
   * `lastSeq` so the replayed events (seq ≤ the server head) still pass `accept`.
   */
  onSubscribed(topic: string, seq: number, resumed: boolean) {
    const entry = this.topics.get(topic)
    if (!entry) return
    entry.active = true
    if (!resumed || entry.lastSeq === null) entry.lastSeq = seq
  }

  /** True for an event to deliver: no `seq` (per-connection) or newer than the last one. Advances `lastSeq`. */
  accept(topic: string, seq: number | null): boolean {
    const entry = this.topics.get(topic)
    if (!entry) return false
    if (seq === null) return true
    if (entry.lastSeq !== null && seq <= entry.lastSeq) return false
    entry.lastSeq = seq

    return true
  }

  /** `resync`: the resume point is gone; the next subscribe starts fresh. */
  forgetSeq(topic: string) {
    const entry = this.topics.get(topic)
    if (entry) entry.lastSeq = null
  }
}
