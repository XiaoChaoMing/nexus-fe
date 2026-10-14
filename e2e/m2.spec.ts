import type { ChildProcess } from 'node:child_process'
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { apiContext, apiLogin, apiRegister, APP_URL, freshStreamKey, hasFfmpeg, publish, SEED_CREATOR, SEED_PASSWORD, uniqueUser, openLiveFromHome } from './helpers.ts'

/**
 * M2 (working plan GĐ2 §11): the seed creator goes live with ffmpeg → a guest finds the stream on Home and
 * watches it (720p/480p/360p) → OBS drops ("Streamer sẽ quay lại ngay") → the creator ends it ("Buổi phát đã
 * kết thúc") → replay → a signed-in viewer is offered to resume after a reload, and finds the replay in
 * "Tiếp tục xem". Second test: the 18+ gate is served by the playback session before any manifest loads.
 * Needs the whole stack behind the edge and ffmpeg; playback checks need a browser that decodes H.264.
 */

type StudioSettings = { title: string; tags: string[]; language: string; isMature: boolean }
type Studio = { settings: StudioSettings; current: { streamId: string; status: string } | null }

async function canDecodeH264(page: Page) {
  return page.evaluate(() => 'MediaSource' in window && MediaSource.isTypeSupported('video/mp4; codecs="avc1.4d401f,mp4a.40.2"'))
}

/** The creator's Studio API, used for setup and cleanup (the Studio UI is covered by livestream.spec). */
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

  async updateSettings(patch: Partial<StudioSettings>) {
    const { settings } = await this.studio()
    const res = await this.api.put('/v1/studio/stream', { headers: this.headers, data: { ...settings, ...patch } })
    expect(res.status(), 'PUT studio settings').toBe(200)
  }

  /** Ends a broadcast if one is on air; returns true when it did (the 30 s end cooldown then applies). */
  async endIfLive(): Promise<boolean> {
    const { current } = await this.studio()
    if (!current) return false
    const res = await this.api.post('/v1/studio/stream/end', { headers: this.headers })
    expect([200, 202, 204, 409]).toContain(res.status())

    return true
  }

  async waitLive(title: string): Promise<string> {
    let id = ''
    await expect(async () => {
      const res = await this.api.get('/v1/streams?status=live')
      const items = ((await res.json()) as { data: { items: { id: string; title: string; status: string }[] } }).data.items
      const found = items.find((s) => s.title === title && s.status === 'LIVE')
      expect(found, `live stream "${title}"`).toBeTruthy()
      id = found!.id
    }).toPass({ timeout: 45_000 })

    return id
  }

  async dispose() {
    await this.api.dispose()
  }
}

/** A Studio page of the seed creator, to read a fresh stream key (shown once). */
async function creatorStreamKey(browser: Browser): Promise<{ key: string; ctx: BrowserContext }> {
  const ctx = await browser.newContext({ baseURL: APP_URL, locale: 'vi-VN' })
  const login = await ctx.request.post('/v1/auth/login', { data: { login: SEED_CREATOR, password: SEED_PASSWORD } })
  expect(login.status()).toBe(200)
  const page = await ctx.newPage()
  await page.goto('/studio/stream')
  await expect(page.getByTestId('studio-status')).toBeVisible({ timeout: 30_000 })

  return { key: await freshStreamKey(page), ctx }
}

/** Fresh account signed in through the refresh cookie of its own browser context. */
async function signedInViewer(browser: Browser): Promise<BrowserContext> {
  const user = uniqueUser('m2')
  const api = await apiContext()
  await apiRegister(api, user)
  await api.dispose()
  const ctx = await browser.newContext({ baseURL: APP_URL, locale: 'vi-VN' })
  const res = await ctx.request.post('/v1/auth/login', { data: { login: user.username, password: user.password } })
  expect(res.status()).toBe(200)

  return ctx
}

test.skip(!hasFfmpeg(), 'ffmpeg is needed to publish a stream')

test('M2: go live, watch with quality switch, interruption, end, replay and resume', async ({ browser }) => {
  test.setTimeout(420_000)
  const creator = await CreatorApi.open()
  let obs: ChildProcess | undefined
  const contexts: BrowserContext[] = []

  try {
    if (await creator.endIfLive()) await new Promise((r) => setTimeout(r, 31_000))
    const { key, ctx: studioCtx } = await creatorStreamKey(browser)
    contexts.push(studioCtx)
    const title = `M2 ${Date.now().toString(36)}`
    await creator.updateSettings({ title, tags: ['m2', 'e2e'], language: 'vi', isMature: false })

    // A publish within STREAM_END_COOLDOWN (30 s) of another spec ending a broadcast is refused: retry once.
    obs = publish(key, 240)
    let streamId: string
    try {
      streamId = await creator.waitLive(title)
    } catch {
      obs.kill('SIGKILL')
      obs = publish(key, 240)
      streamId = await creator.waitLive(title)
    }

    // Guest: Home shows the hero and the card; the card opens the live room.
    const guestCtx = await browser.newContext({ baseURL: APP_URL, locale: 'vi-VN' })
    contexts.push(guestCtx)
    const guest = await guestCtx.newPage()
    await guest.goto('/')
    await expect(guest.getByTestId('home-hero')).toBeVisible()
    const playbackOpened = guest.waitForResponse((r) => r.url().endsWith(`/v1/streams/${streamId}/playback`) && r.request().method() === 'POST')
    await openLiveFromHome(guest, title)
    await expect(guest).toHaveURL(new RegExp(`/live/${streamId}$`))
    await expect(guest.getByRole('heading', { name: title })).toBeVisible()
    // The manifest comes from the playback session (WP1), with the guest's anon id.
    const playback = await playbackOpened
    expect(playback.status()).toBe(200)
    expect(playback.request().headers()['x-nxl-anon-id']).toMatch(/^[0-9a-f-]{36}$/)
    expect(((await playback.json()) as { data: { manifestUrl: string | null } }).data.manifestUrl).toContain('master.m3u8')
    await expect(guest.getByTestId('chat-panel').first()).toBeVisible()

    const decodes = await canDecodeH264(guest)
    const player = guest.getByTestId('player')

    if (decodes) {
      await expect(player).toHaveAttribute('data-state', 'live', { timeout: 30_000 })
      await player.hover()
      await guest.getByRole('button', { name: /^Chất lượng/ }).click()
      await expect(guest.getByRole('menuitemradio', { name: /^Tự động/ })).toBeVisible()
      for (const q of ['720p', '480p', '360p']) await expect(guest.getByRole('menuitemradio', { name: q, exact: true })).toBeVisible()
      await guest.getByRole('menuitemradio', { name: '360p', exact: true }).click()
      await expect(guest.getByRole('button', { name: 'Chất lượng: 360p' })).toBeVisible()
    } else {
      test.info().annotations.push({ type: 'skipped-playback', description: 'browser cannot decode H.264 (use Chrome via E2E_CHROMIUM_PATH)' })
    }

    // OBS drops: the room says the streamer will be right back.
    obs.kill('SIGKILL')
    if (decodes) {
      await expect(guest.getByText('Streamer sẽ quay lại ngay')).toBeVisible({ timeout: 30_000 })
      await expect(player).toHaveAttribute('data-state', 'interrupted')
    } else {
      await expect(guest.getByText('Tạm gián đoạn').first()).toBeVisible({ timeout: 30_000 })
    }

    // The creator ends the broadcast: "Buổi phát đã kết thúc", then the replay link.
    await creator.endIfLive()
    await expect(guest.getByText('Buổi phát đã kết thúc').first()).toBeVisible({ timeout: 60_000 })
    const replay = guest.getByRole('link', { name: 'Xem lại' })
    await expect(replay).toBeVisible({ timeout: 90_000 })
    await replay.click()
    await expect(guest).toHaveURL(/\/vod\/[0-9a-f-]{36}$/)
    await expect(guest.getByRole('heading', { name: title })).toBeVisible()
    const vodUrl = guest.url()

    // Signed-in viewer: watch a few seconds, reload → "Xem tiếp từ …?", and the replay is in "Tiếp tục xem".
    if (decodes) {
      const viewerCtx = await signedInViewer(browser)
      contexts.push(viewerCtx)
      const viewer = await viewerCtx.newPage()
      await viewer.goto(vodUrl)
      await expect(viewer.getByTestId('player')).toHaveAttribute('data-state', 'live', { timeout: 30_000 })
      await viewer.waitForTimeout(9_000)
      await viewer.reload()
      await expect(viewer.getByTestId('vod-resume')).toBeVisible()
      await expect(viewer.getByRole('heading', { name: /^Xem tiếp từ \d{2}:\d{2}\?$/ })).toBeVisible()
      await viewer.getByRole('button', { name: 'Xem tiếp' }).click()
      await expect(viewer.getByTestId('player')).toBeVisible()

      await viewer.goto('/')
      await expect(viewer.getByTestId('continue-watching').getByText(title)).toBeVisible()
    }
  } finally {
    obs?.kill('SIGKILL')
    await creator.endIfLive().catch(() => undefined)
    await creator.dispose()
    for (const c of contexts) await c.close()
  }
})

test('M2: an 18+ stream is gated by the playback session until the guest confirms', async ({ browser }) => {
  test.setTimeout(300_000)
  const creator = await CreatorApi.open()
  let obs: ChildProcess | undefined
  const contexts: BrowserContext[] = []

  try {
    if (await creator.endIfLive()) await new Promise((r) => setTimeout(r, 31_000))
    const { key, ctx: studioCtx } = await creatorStreamKey(browser)
    contexts.push(studioCtx)
    const title = `M2 18+ ${Date.now().toString(36)}`
    await creator.updateSettings({ title, tags: ['m2'], language: 'vi', isMature: true })

    obs = publish(key, 120)
    let streamId: string
    try {
      streamId = await creator.waitLive(title)
    } catch {
      // Refused inside the end cooldown of the previous test: retry once.
      obs.kill('SIGKILL')
      obs = publish(key, 120)
      streamId = await creator.waitLive(title)
    }

    const guestCtx = await browser.newContext({ baseURL: APP_URL, locale: 'vi-VN' })
    contexts.push(guestCtx)
    const guest = await guestCtx.newPage()
    const manifests: string[] = []
    guest.on('request', (r) => {
      if (r.url().includes('.m3u8')) manifests.push(r.url())
    })

    await guest.goto(`/live/${streamId}`)
    const gate = guest.getByTestId('mature-gate')
    await expect(gate).toBeVisible()
    await expect(gate.getByText('Nội dung dành cho người từ 18 tuổi')).toBeVisible()
    // Guests confirm every time: no "do not ask again" box.
    await expect(gate.getByText('Không hỏi lại với kênh này')).toHaveCount(0)
    await guest.waitForTimeout(2_000)
    expect(manifests, 'no manifest before the confirmation').toEqual([])

    const confirmed = guest.waitForResponse((r) => r.url().endsWith(`/v1/streams/${streamId}/playback`) && (r.request().postData() ?? '').includes('acknowledgeMature'))
    await gate.getByRole('button', { name: 'Tôi đủ 18 tuổi, tiếp tục xem' }).click()
    const body = ((await (await confirmed).json()) as { data: { manifestUrl: string | null; mature: { acknowledged: boolean } } }).data
    expect(body.mature.acknowledged).toBe(true)
    expect(body.manifestUrl).toContain('master.m3u8')
    await expect(gate).toHaveCount(0)
    await expect.poll(() => manifests.length, { timeout: 20_000 }).toBeGreaterThan(0)

    if (await canDecodeH264(guest)) {
      await expect(guest.getByTestId('player')).toHaveAttribute('data-state', 'live', { timeout: 30_000 })
    }
  } finally {
    obs?.kill('SIGKILL')
    // Leave the seed creator as other specs expect it, even when the test failed.
    await creator.updateSettings({ isMature: false }).catch(() => undefined)
    await creator.endIfLive().catch(() => undefined)
    await creator.dispose()
    for (const c of contexts) await c.close()
  }
})
