import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { expect, request, type APIRequestContext, type Page } from '@playwright/test'

/** Dev seed accounts (identity `IDENTITY_DEV_SEED=true`, TSD GĐ1 §5). */
export const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD ?? 'nexuslive123'
export const SEED_ADMIN = 'admin@nexuslive.dev'
export const SEED_CREATOR = 'creator@nexuslive.dev'

/** Same origin as the app: requests go through the Vite proxy to the edge. */
export const APP_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025'
export const RTMP = process.env.E2E_RTMP_URL ?? 'rtmp://localhost:1935/live'

export function uniqueUser(prefix = 'e2e') {
  const name = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`.slice(0, 25)

  return { username: name, email: `${name}@example.com`, password: 'passw0rdx' }
}

/** A request context that does not share cookies with the browser page (the page stays a guest). */
export async function apiContext(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: APP_URL })
}

export async function apiLogin(api: APIRequestContext, login: string, password = SEED_PASSWORD): Promise<string> {
  const res = await api.post('/v1/auth/login', { data: { login, password } })
  expect(res.status(), `login ${login}`).toBe(200)

  return ((await res.json()) as { data: { accessToken: string } }).data.accessToken
}

export async function apiRegister(api: APIRequestContext, user: { username: string; email: string; password: string }) {
  const res = await api.post('/v1/auth/register', { data: { ...user, displayName: user.username, acceptTerms: true } })
  expect(res.status(), 'register').toBe(201)
}

type AdminApplication = { id: string; status: string; user: { email: string } }

/** Approves the pending Creator application of `email` as the seed admin (what nexuslive-admin does). */
export async function approveApplicationOf(email: string) {
  const api = await apiContext()
  try {
    const token = await apiLogin(api, SEED_ADMIN)
    const auth = { Authorization: `Bearer ${token}` }
    let found: AdminApplication | undefined

    await expect(async () => {
      let cursor = ''
      found = undefined
      do {
        const res = await api.get(`/v1/admin/creator-applications?status=PENDING&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: auth })
        expect(res.status()).toBe(200)
        const page = ((await res.json()) as { data: { items: AdminApplication[]; nextCursor: string | null } }).data
        found = page.items.find((a) => a.user.email.toLowerCase() === email.toLowerCase())
        cursor = page.nextCursor ?? ''
      } while (!found && cursor)
      expect(found, `pending application of ${email}`).toBeTruthy()
    }).toPass({ timeout: 15_000 })

    const res = await api.post(`/v1/admin/creator-applications/${found!.id}/approve`, { headers: auth })
    expect(res.status(), 'approve').toBe(200)
  } finally {
    await api.dispose()
  }
}

type MailpitSummary = { ID: string; Created: string }

/** Waits for the newest email to `to` in Mailpit and returns the first link containing `path`. */
export async function linkFromMail(to: string, path: string, timeout = 30_000): Promise<string> {
  const api = await request.newContext({ baseURL: MAILPIT_URL })
  try {
    let link = ''
    await expect(async () => {
      const search = await api.get(`/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)
      expect(search.ok()).toBe(true)
      const messages = ((await search.json()) as { messages?: MailpitSummary[] }).messages ?? []
      expect(messages.length, `mail to ${to}`).toBeGreaterThan(0)
      const newest = [...messages].sort((a, b) => b.Created.localeCompare(a.Created))[0]
      const msg = (await (await api.get(`/api/v1/message/${newest.ID}`)).json()) as { Text?: string; HTML?: string }
      const body = `${msg.Text ?? ''}\n${msg.HTML ?? ''}`
      const match = body.match(new RegExp(`https?://[^\\s"'<>]*${path.replace(/[/?]/g, '\\$&')}[^\\s"'<>]*`))
      expect(match, `link ${path} in mail`).toBeTruthy()
      link = match![0].replace(/&amp;/g, '&')
    }).toPass({ timeout })

    // The mail points at IDENTITY_WEB_BASE_URL; open the same path on the app under test.
    const url = new URL(link)

    return url.pathname + url.search
  } finally {
    await api.dispose()
  }
}

export function hasFfmpeg(): boolean {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
}

/** ffmpeg plays OBS: a test pattern with a tone, pushed over RTMP with the stream key. */
export function publish(key: string, seconds: number): ChildProcess {
  return spawn(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-re',
      '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-g', '60',
      '-c:a', 'aac', '-t', String(seconds), '-f', 'flv', `${RTMP}/${key}`,
    ],
    { stdio: 'ignore' },
  )
}

/** In Studio: shows a fresh stream key (creating one, or regenerating when the channel already has one). */
export async function freshStreamKey(page: Page): Promise<string> {
  const create = page.getByRole('button', { name: 'Tạo stream key' })
  const regenerate = page.getByRole('button', { name: 'Tạo lại key' })
  await expect(create.or(regenerate)).toBeVisible({ timeout: 30_000 })
  if (await create.isVisible()) {
    await create.click()
  } else {
    await regenerate.click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Tạo key mới' }).click()
  }
  const keyInput = page.getByRole('textbox', { name: 'Stream key' })
  await expect(keyInput).toHaveValue(/^live_/)

  return keyInput.inputValue()
}

/**
 * Opens a live stream from the home page. The top recommended stream is the Hero and is left out of the
 * "Live đề xuất" row (TSD GĐ4 §3.1), so the stream is either behind "Xem ngay" or a stream card.
 */
export async function openLiveFromHome(page: Page, title: string) {
  const hero = page.getByTestId('home-hero').filter({ hasText: title })
  const card = page.getByTestId('stream-card').filter({ hasText: title })
  await expect(hero.or(card).first()).toBeVisible({ timeout: 60_000 })
  if (await hero.count()) await hero.getByTestId('hero-watch').click()
  else await card.first().click()
}
