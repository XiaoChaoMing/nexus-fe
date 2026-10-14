import { crc32, deflateSync } from 'node:zlib'
import { expect, type APIRequestContext, type Browser, type BrowserContext } from '@playwright/test'
import { apiContext, apiLogin, APP_URL, SEED_CREATOR } from './helpers.ts'

/** GĐ4 E2E helpers (working plan GĐ4 WP10): the seed creator driven through the API, plus test images. */

type Settings = { title: string; tags: string[]; language: string; isMature: boolean; categoryId?: string | null }
type Studio = { settings: Settings; current: { streamId: string; status: string } | null }
export type Category = { id: string; slug: string; name: string }
export type StudioChannel = { id: string; handle: string; displayName: string }

export class CreatorV4 {
  readonly api: APIRequestContext
  private readonly token: string

  private constructor(api: APIRequestContext, token: string) {
    this.api = api
    this.token = token
  }

  static async open(login = SEED_CREATOR): Promise<CreatorV4> {
    const api = await apiContext()

    return new CreatorV4(api, await apiLogin(api, login))
  }

  get headers() {
    return { Authorization: `Bearer ${this.token}` }
  }

  async channel(): Promise<StudioChannel> {
    const res = await this.api.get('/v1/studio/channel', { headers: this.headers })
    expect(res.status(), 'GET /v1/studio/channel').toBe(200)

    return ((await res.json()) as { data: StudioChannel }).data
  }

  async timezone(): Promise<string> {
    const res = await this.api.get('/v1/me', { headers: this.headers })
    const tz = ((await res.json()) as { data: { user: { timezone?: string } } }).data.user.timezone

    return tz || 'Asia/Ho_Chi_Minh'
  }

  async studio(): Promise<Studio> {
    const res = await this.api.get('/v1/studio/stream', { headers: this.headers })
    expect(res.status(), 'GET studio').toBe(200)

    return ((await res.json()) as { data: Studio }).data
  }

  /** PUT replaces the settings: the category is always sent (absent = none). */
  async setStream(title: string, categoryId: string | null) {
    const { settings } = await this.studio()
    const res = await this.api.put('/v1/studio/stream', {
      headers: this.headers,
      data: { title, tags: ['m4', 'e2e'], language: settings.language || 'vi', isMature: false, categoryId },
    })
    expect(res.status(), `PUT studio settings: ${await res.text()}`).toBe(200)
  }

  async streamKey(): Promise<string> {
    const res = await this.api.post('/v1/studio/stream-key', { headers: this.headers })
    expect(res.status(), 'POST stream key').toBe(201)

    return ((await res.json()) as { data: { streamKey: string } }).data.streamKey
  }

  async endIfLive(): Promise<boolean> {
    const { current } = await this.studio()
    if (!current) return false
    const res = await this.api.post('/v1/studio/stream/end', { headers: this.headers })
    expect([200, 202, 204, 409]).toContain(res.status())

    return true
  }

  async waitLive(title: string, timeout = 45_000): Promise<{ id: string; channelId: string }> {
    let found: { id: string; channelId: string } | undefined
    await expect(async () => {
      const res = await this.api.get('/v1/streams?status=live&sort=newest')
      const items = ((await res.json()) as { data: { items: { id: string; channelId: string; title: string; status: string }[] } }).data.items
      found = items.find((s) => s.title === title && s.status === 'LIVE')
      expect(found, `live stream "${title}"`).toBeTruthy()
    }).toPass({ timeout })

    return found!
  }

  async dispose() {
    await this.api.dispose()
  }
}

/** The seeded category whose name contains `name` (e.g. "Liên Minh"). */
export async function findCategory(api: APIRequestContext, name: RegExp): Promise<Category> {
  const res = await api.get('/v1/categories')
  expect(res.status(), 'GET /v1/categories').toBe(200)
  const items = ((await res.json()) as { data: { items: Category[] } }).data.items
  const found = items.find((c) => name.test(c.name))
  expect(found, `category ${name}`).toBeTruthy()

  return found!
}

/** A browser context already signed in through its own refresh cookie. */
export async function signedIn(browser: Browser, login: string, password: string, timezoneId?: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({ baseURL: APP_URL, locale: 'vi-VN', timezoneId })
  const res = await ctx.request.post('/v1/auth/login', { data: { login, password } })
  expect(res.status(), `login ${login}`).toBe(200)

  return ctx
}

/** A solid-colour PNG of `w`×`h` (RGB), built without an image library. */
export function solidPng(w: number, h: number, rgb: [number, number, number]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)

    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  const row = Buffer.alloc(1 + w * 3)
  for (let x = 0; x < w; x++) row.set(rgb, 1 + x * 3)
  const raw = Buffer.concat(Array.from({ length: h }, () => row))

  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

/** "YYYY-MM-DD" and "HH:mm" of an instant in a time zone (what the schedule form expects). */
export function localDateTime(ms: number, timeZone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  )

  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}
