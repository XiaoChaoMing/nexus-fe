import type { ChildProcess } from 'node:child_process'
import { expect, request, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { apiContext, apiLogin, APP_URL, MAILPIT_URL, publish, SEED_ADMIN, uniqueUser } from './helpers.ts'
import { CreatorV4 } from './m4-helpers.ts'

/** GĐ5 E2E helpers (working plan GĐ5 WP10): accounts with ids, the seed creator on air, the admin API, Mailpit. */

export type Account = { id: string; username: string; email: string; password: string }

/** Registers a fresh account and returns its id (the moderation APIs take ids). */
export async function registerAccount(prefix: string): Promise<Account> {
  const user = uniqueUser(prefix)
  const api = await apiContext()
  try {
    const res = await api.post('/v1/auth/register', { data: { ...user, displayName: user.username, acceptTerms: true } })
    expect(res.status(), `register ${user.username}`).toBe(201)
    const id = ((await res.json()) as { data: { user: { id: string } } }).data.user.id

    return { id, ...user }
  } finally {
    await api.dispose()
  }
}

/** A browser context signed in through its own refresh cookie (desktop, Vietnamese). */
export async function signIn(browser: Browser, login: string, password: string, opts: { viewport?: { width: number; height: number } } = {}): Promise<BrowserContext> {
  const ctx = await browser.newContext({ baseURL: APP_URL, locale: 'vi-VN', viewport: opts.viewport })
  const res = await ctx.request.post('/v1/auth/login', { data: { login, password } })
  expect(res.status(), `login ${login}`).toBe(200)

  return ctx
}

/** The seed creator on air with a fresh key; retries once inside the end cooldown of an earlier spec. */
export async function goLive(creator: CreatorV4, prefix: string, seconds = 420): Promise<{ title: string; stream: { id: string; channelId: string }; obs: ChildProcess }> {
  if (await creator.endIfLive()) await new Promise((r) => setTimeout(r, 31_000))
  const title = `${prefix} ${Date.now().toString(36)}`
  await creator.setStream(title, null)
  const key = await creator.streamKey()
  let obs = publish(key, seconds)
  try {
    return { title, stream: await creator.waitLive(title, 40_000), obs }
  } catch {
    obs.kill('SIGKILL')
    await new Promise((r) => setTimeout(r, 31_000))
    obs = publish(key, seconds)

    return { title, stream: await creator.waitLive(title, 45_000), obs }
  }
}

/** The seed admin through the API, as nexuslive-admin would call it. */
export class AdminApi {
  private constructor(
    readonly api: APIRequestContext,
    private readonly token: string,
  ) {}

  static async open(): Promise<AdminApi> {
    const api = await apiContext()

    return new AdminApi(api, await apiLogin(api, SEED_ADMIN))
  }

  get headers() {
    return { Authorization: `Bearer ${this.token}` }
  }

  /** The open report on a target (safety copies it asynchronously). */
  async reportOn(targetId: string): Promise<{ id: string; status: string }> {
    let found: { id: string; status: string } | undefined
    await expect(async () => {
      const res = await this.api.get('/v1/admin/reports?status=OPEN,IN_REVIEW&limit=50', { headers: this.headers })
      expect(res.status()).toBe(200)
      const items = ((await res.json()) as { data: { items: { id: string; status: string; target: { id: string } }[] } }).data.items
      found = items.find((r) => r.target.id === targetId)
      expect(found, `report on ${targetId}`).toBeTruthy()
    }).toPass({ timeout: 15_000 })

    return found!
  }

  async lockUser(userId: string, hours: 24 | 168 | 720 | null, reportId?: string) {
    const res = await this.api.post(`/v1/admin/users/${userId}/lock`, { headers: this.headers, data: { durationHours: hours, reason: 'E2E: spam lừa đảo trong chat', ...(reportId ? { reportId } : {}) } })
    expect(res.status(), `lock: ${await res.text()}`).toBe(202)
  }

  async resolve(reportId: string) {
    const res = await this.api.post(`/v1/admin/reports/${reportId}/resolve`, { headers: this.headers, data: { status: 'RESOLVED', note: 'E2E: đã khóa tài khoản vi phạm', applyToSameTarget: true } })
    expect(res.status(), `resolve: ${await res.text()}`).toBe(200)
  }

  async takedown(streamId: string) {
    const res = await this.api.post(`/v1/admin/streams/${streamId}/takedown`, { headers: this.headers, data: { reason: 'E2E: nội dung vi phạm quy định' } })
    expect(res.status(), `takedown: ${await res.text()}`).toBe(202)
  }

  async dispose() {
    await this.api.dispose()
  }
}

type MailSummary = { ID: string; Created: string; Subject: string }

/** Newest mail to `to` whose subject matches, with its text and HTML. */
export async function waitForMail(to: string, subject: RegExp, timeout = 60_000): Promise<{ subject: string; text: string; html: string }> {
  const api = await request.newContext({ baseURL: MAILPIT_URL })
  try {
    let out = { subject: '', text: '', html: '' }
    await expect(async () => {
      const search = await api.get(`/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)
      const messages = ((await search.json()) as { messages?: MailSummary[] }).messages ?? []
      const hit = [...messages].sort((a, b) => b.Created.localeCompare(a.Created)).find((m) => subject.test(m.Subject))
      expect(hit, `mail "${subject}" to ${to}`).toBeTruthy()
      const msg = (await (await api.get(`/api/v1/message/${hit!.ID}`)).json()) as { Text?: string; HTML?: string }
      out = { subject: hit!.Subject, text: msg.Text ?? '', html: msg.HTML ?? '' }
    }).toPass({ timeout })

    return out
  } finally {
    await api.dispose()
  }
}

/** Opens a live room and waits until the chat is subscribed (the input leaves "Đang kết nối chat…"). */
export async function openRoom(page: Page, streamId: string) {
  await page.goto(`/live/${streamId}`)
  await expect(page.getByTestId('chat-column')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('chat-list')).toBeVisible()
}

export async function sendChat(page: Page, text: string) {
  const input = page.getByTestId('chat-input')
  await expect(input).toBeEnabled({ timeout: 30_000 })
  await input.fill(text)
  await input.press('Enter')
}

/** One chat line of `text` (the newest when repeated). */
export function chatLine(page: Page, text: string) {
  return page.getByTestId('chat-message').filter({ hasText: text }).last()
}

/** Opens "⋯" of a line (hover first: the button only shows on hover) and returns the menu. */
export async function openLineMenu(page: Page, text: string) {
  const line = chatLine(page, text)
  await line.hover()
  await line.getByTestId('message-more').click()
  const menu = page.getByTestId('message-menu')
  await expect(menu).toBeVisible()

  return menu
}
