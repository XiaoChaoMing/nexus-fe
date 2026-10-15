import type { ChildProcess } from 'node:child_process'
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { apiContext, apiLogin, apiRegister, APP_URL, freshStreamKey, hasFfmpeg, publish, SEED_CREATOR, SEED_PASSWORD, uniqueUser } from './helpers.ts'

/**
 * M3 (working plan GĐ3 WP8): the seed creator goes live with ffmpeg; viewer A (account) and guest B watch the
 * same room. A sends → B sees it; B clicking the input gets the login modal; the creator turns on slow mode from
 * the chat settings → A's next message waits for the countdown and the server refuses a send that skips it;
 * the creator ends the broadcast → the chat becomes read-only for everyone.
 * Needs the whole stack behind the edge (chat-svc included) and ffmpeg.
 */

type Studio = { settings: { title: string; tags: string[]; language: string; isMature: boolean }; current: { streamId: string; status: string } | null }

class CreatorApi {
  private readonly api: APIRequestContext
  private readonly token: string

  private constructor(api: APIRequestContext, token: string) {
    this.api = api
    this.token = token
  }

  static async open(): Promise<CreatorApi> {
    const api = await apiContext()

    return new CreatorApi(api, await apiLogin(api, SEED_CREATOR))
  }

  private get headers() {
    return { Authorization: `Bearer ${this.token}` }
  }

  async studio(): Promise<Studio> {
    const res = await this.api.get('/v1/studio/stream', { headers: this.headers })
    expect(res.status(), 'GET studio').toBe(200)

    return ((await res.json()) as { data: Studio }).data
  }

  async setTitle(title: string) {
    const { settings } = await this.studio()
    const res = await this.api.put('/v1/studio/stream', { headers: this.headers, data: { ...settings, title, tags: ['m3', 'e2e'], isMature: false } })
    expect(res.status(), 'PUT studio settings').toBe(200)
  }

  async endIfLive(): Promise<boolean> {
    const { current } = await this.studio()
    if (!current) return false
    const res = await this.api.post('/v1/studio/stream/end', { headers: this.headers })
    expect([200, 202, 204, 409]).toContain(res.status())

    return true
  }

  async waitLive(title: string): Promise<{ id: string; channelId: string }> {
    let found: { id: string; channelId: string } | undefined
    await expect(async () => {
      const res = await this.api.get('/v1/streams?status=live')
      const items = ((await res.json()) as { data: { items: { id: string; channelId: string; title: string; status: string }[] } }).data.items
      found = items.find((s) => s.title === title && s.status === 'LIVE')
      expect(found, `live stream "${title}"`).toBeTruthy()
    }).toPass({ timeout: 45_000 })

    return found!
  }

  /** Leaves the seed channel's chat as other specs expect it. */
  async resetChat(channelId: string) {
    const res = await this.api.put(`/v1/channels/${channelId}/chat-settings`, { headers: this.headers, data: { slowSec: 0, followersMin: null, subsOnly: false } })
    expect(res.status(), `reset chat settings: ${await res.text()}`).toBe(200)
  }

  async dispose() {
    await this.api.dispose()
  }
}

/** A browser context signed in through its own refresh cookie. */
async function signedInContext(browser: Browser, login: string, password: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({ baseURL: APP_URL, locale: 'vi-VN' })
  const res = await ctx.request.post('/v1/auth/login', { data: { login, password } })
  expect(res.status(), `login ${login}`).toBe(200)

  return ctx
}

async function openRoom(page: Page, streamId: string) {
  await page.goto(`/live/${streamId}`)
  await expect(page.getByTestId('chat-column')).toBeVisible()
  // History loaded and the room subscribed (the input leaves "Đang kết nối chat…").
  await expect(page.getByTestId('chat-list')).toBeVisible()
}

async function send(page: Page, text: string) {
  const input = page.getByTestId('chat-input')
  await expect(input).toBeEnabled({ timeout: 30_000 })
  await input.fill(text)
  await input.press('Enter')
}

test.skip(!hasFfmpeg(), 'ffmpeg is needed to publish a stream')

test('M3: realtime chat between a viewer and a guest, login gate, slow mode, read-only after the end', async ({ browser }) => {
  test.setTimeout(420_000)
  const creator = await CreatorApi.open()
  const contexts: BrowserContext[] = []
  let obs: ChildProcess | undefined
  let channelId = ''

  try {
    if (await creator.endIfLive()) await new Promise((r) => setTimeout(r, 31_000))

    // Creator: fresh key from the Studio, then ffmpeg plays OBS.
    const creatorCtx = await signedInContext(browser, SEED_CREATOR, SEED_PASSWORD)
    contexts.push(creatorCtx)
    const studio = await creatorCtx.newPage()
    await studio.goto('/studio/stream')
    await expect(studio.getByTestId('studio-status')).toBeVisible({ timeout: 30_000 })
    const key = await freshStreamKey(studio)
    const title = `M3 ${Date.now().toString(36)}`
    await creator.setTitle(title)
    obs = publish(key, 300)
    let stream: { id: string; channelId: string }
    try {
      stream = await creator.waitLive(title)
    } catch {
      // Refused inside the end cooldown of an earlier spec: retry once.
      obs.kill('SIGKILL')
      obs = publish(key, 300)
      stream = await creator.waitLive(title)
    }
    channelId = stream.channelId
    await creator.resetChat(channelId)

    // Viewer A (a fresh account) and guest B in the same room.
    const userA = uniqueUser('m3a')
    const api = await apiContext()
    await apiRegister(api, userA)
    await api.dispose()
    const aCtx = await signedInContext(browser, userA.username, userA.password)
    contexts.push(aCtx)
    const a = await aCtx.newPage()
    const bCtx = await browser.newContext({ baseURL: APP_URL, locale: 'vi-VN' })
    contexts.push(bCtx)
    const b = await bCtx.newPage()
    await openRoom(a, stream.id)
    await openRoom(b, stream.id)

    // A sends → it is delivered for A and appears for B.
    const hello = `Xin chào M3 ${Date.now().toString(36)}`
    await send(a, hello)
    await expect(a.getByTestId('chat-message').filter({ hasText: hello })).toHaveAttribute('data-delivery', 'DELIVERED')
    await expect(b.getByTestId('chat-message').filter({ hasText: hello })).toBeVisible({ timeout: 10_000 })
    await expect(b.getByTestId('chat-message').filter({ hasText: hello }).getByTestId('chat-username')).toHaveText(userA.username)

    // The real viewer count reaches the room (chat-svc counts every 10 s).
    await expect(b.getByTestId('viewer-count').first()).toBeVisible({ timeout: 30_000 })

    // B is a guest: the input is a login prompt that opens the modal (AF10).
    const guestInput = b.getByTestId('chat-guest-input')
    await expect(guestInput).toHaveText('Đăng nhập để trò chuyện')
    await guestInput.click()
    await expect(b.getByTestId('auth-modal')).toBeVisible()
    await b.keyboard.press('Escape')
    await expect(b.getByTestId('auth-modal')).toHaveCount(0)

    // The creator turns on slow mode (30 s: a loaded 2-CPU runner can spend 10 s on the steps below) from the chat
    // column: applied at once, everyone sees it.
    const c = await creatorCtx.newPage()
    await openRoom(c, stream.id)
    await c.getByTestId('chat-settings').click()
    await c.getByTestId('chat-settings-form').getByRole('radio', { name: '30 giây' }).click()
    await expect(c.getByTestId('chat-settings-form').getByRole('radio', { name: '30 giây' })).toHaveAttribute('aria-checked', 'true')
    await expect(c.getByText('Đã bật chế độ chậm 30 giây')).toBeVisible()
    await c.keyboard.press('Escape')
    await expect(a.getByTestId('chat-mode-bar')).toContainText('Chậm 30 giây')
    await expect(b.getByText('Chế độ chậm đã bật: 30 giây')).toBeVisible()

    // A second tab of A is opened now: opening a page can take longer than the slow-mode window.
    const a2 = await aCtx.newPage()
    await openRoom(a2, stream.id)

    // A's first message goes through and starts the countdown on the send button; the next one waits.
    const first = `Slow 1 ${Date.now().toString(36)}`
    await send(a, first)
    await expect(a.getByTestId('chat-message').filter({ hasText: first })).toHaveAttribute('data-delivery', 'DELIVERED')
    await expect(a.getByTestId('chat-send')).toHaveText(/^\d+$/)
    await expect(a.getByTestId('chat-send')).toBeDisabled()
    const second = `Slow 2 ${Date.now().toString(36)}`
    await a.getByTestId('chat-input').fill(second)
    await a.getByTestId('chat-input').press('Enter')
    await expect(a.getByTestId('chat-input')).toHaveValue(second)
    await expect(b.getByTestId('chat-message').filter({ hasText: second })).toHaveCount(0)

    // The server enforces it too: another tab of A has no local countdown, yet its message is refused (or the
    // snapshot already says to wait) and shows the countdown; nothing reaches the room.
    const third = `Slow 3 ${Date.now().toString(36)}`
    await send(a2, third)
    await expect(a2.getByTestId('chat-send')).toHaveText(/^\d+$/)
    if (await a2.getByTestId('chat-notice').isVisible()) {
      await expect(a2.getByTestId('chat-notice')).toContainText(/Chế độ chậm đang bật\. Bạn gửi lại sau \d+ giây\./)
    }
    await expect(b.getByTestId('chat-message').filter({ hasText: third })).toHaveCount(0)

    // After the countdown the waiting message can be sent.
    await expect(a.getByTestId('chat-send')).toBeEnabled({ timeout: 40_000 })
    await a.getByTestId('chat-input').press('Enter')
    await expect(b.getByTestId('chat-message').filter({ hasText: second })).toBeVisible({ timeout: 10_000 })

    // The creator ends the broadcast: the chat is read-only for the viewer and the guest.
    await creator.endIfLive()
    for (const p of [a, b]) {
      await expect(p.getByTestId('chat-input')).toHaveAttribute('placeholder', 'Buổi phát đã kết thúc — chat chỉ đọc', { timeout: 60_000 })
      await expect(p.getByTestId('chat-input')).toBeDisabled()
      // History stays readable.
      await expect(p.getByTestId('chat-message').filter({ hasText: hello })).toBeVisible()
    }
  } finally {
    obs?.kill('SIGKILL')
    if (channelId) await creator.resetChat(channelId).catch(() => undefined)
    await creator.endIfLive().catch(() => undefined)
    await creator.dispose()
    for (const ctx of contexts) await ctx.close()
  }
})
