import type { ChildProcess } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { apiContext, apiRegister, hasFfmpeg, publish, uniqueUser } from './helpers.ts'
import { CreatorV4, findCategory } from './m4-helpers.ts'

/**
 * GĐ4 Discovery journey (working plan WP10, §11): the seed creator streams in "Liên Minh Huyền Thoại"; a guest
 * presses Ctrl+K and types "lien minh" without diacritics → the category → its live grid → the stream; "Theo dõi"
 * opens the login modal ("Đăng nhập để theo dõi kênh"), signing in finishes the follow; the sidebar shows the
 * channel live (realtime `sidebar:{userId}`), and when the creator ends it moves to offline without a reload.
 * Needs the whole stack behind the edge (channel-svc GĐ4, chat-svc sidebar) and ffmpeg.
 */

test.skip(!hasFfmpeg(), 'ffmpeg is needed to publish a stream')

test('M4 discovery: search without diacritics → category → live → follow after login → sidebar live → offline', async ({ page }) => {
  test.setTimeout(300_000)
  const creator = await CreatorV4.open()
  let obs: ChildProcess | undefined
  const viewer = uniqueUser('m4d')

  try {
    if (await creator.endIfLive()) await new Promise((r) => setTimeout(r, 31_000))
    const lol = await findCategory(creator.api, /Liên Minh/)
    const channel = await creator.channel()
    const title = `M4 discovery ${Date.now().toString(36)}`
    await creator.setStream(title, lol.id)
    const key = await creator.streamKey()
    obs = publish(key, 240)
    let stream: { id: string; channelId: string }
    try {
      stream = await creator.waitLive(title)
    } catch {
      // Refused inside the end cooldown of an earlier spec: retry once.
      obs.kill('SIGKILL')
      obs = publish(key, 240)
      stream = await creator.waitLive(title)
    }

    const api = await apiContext()
    await apiRegister(api, viewer)
    await api.dispose()

    // Guest: Ctrl+K, "lien minh" finds "Liên Minh…" (≤ 300 ms server side; the UI debounces 200 ms).
    await page.goto('/')
    await page.keyboard.press('Control+k')
    const palette = page.getByTestId('search-palette')
    await expect(palette).toBeVisible()
    await palette.getByTestId('search-input').fill('lien minh')
    const categoryGroup = palette.getByTestId('search-group-category')
    await expect(categoryGroup.getByTestId('search-result').filter({ hasText: lol.name })).toBeVisible({ timeout: 10_000 })
    await expect(categoryGroup.locator('strong').first()).toContainText(/Liên Minh/)
    await categoryGroup.getByTestId('search-result').filter({ hasText: lol.name }).first().click()
    await expect(page).toHaveURL(new RegExp(`/browse/${lol.slug}$`))

    // Category page → tab Live, sorted by viewers → the creator's card.
    await expect(page.getByRole('heading', { level: 1, name: lol.name })).toBeVisible()
    const card = page.getByTestId('category-live-grid').getByTestId('stream-card').filter({ hasText: title })
    await expect(card).toBeVisible({ timeout: 30_000 })
    await card.click()
    await expect(page).toHaveURL(new RegExp(`/live/${stream.id}$`))

    // "Theo dõi" as a guest → login modal with its context line → the follow runs once after sign-in.
    await page.getByTestId('follow-button').first().click()
    const modal = page.getByTestId('auth-modal')
    await expect(modal).toContainText('Đăng nhập để theo dõi kênh')
    await modal.getByLabel('Email hoặc tên người dùng').fill(viewer.username)
    await modal.getByLabel('Mật khẩu').fill(viewer.password)
    await modal.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await expect(modal).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`/live/${stream.id}$`))
    await expect(page.getByTestId('follow-button').first()).toHaveText(/Đang theo dõi/, { timeout: 15_000 })
    await expect(page.getByTestId('follow-bell').first()).toBeVisible()

    // Sidebar "Kênh đang theo dõi": the channel is live.
    const sidebarLive = page.getByTestId('sidebar-following').locator(`[data-testid="sidebar-channel-live"][data-channel="${channel.handle}"]`)
    await expect(sidebarLive).toBeVisible({ timeout: 15_000 })

    // Following page, tab Live.
    await page.goto('/following')
    await expect(page.getByTestId('following-live-grid').getByTestId('stream-card').filter({ hasText: title })).toBeVisible()

    // The creator ends: ≤ 5 s over `sidebar:` (the assertion leaves room for the edge and ffmpeg shutting down).
    await creator.endIfLive()
    const sidebarOffline = page.getByTestId('sidebar-following').locator(`[data-testid="sidebar-channel-offline"][data-channel="${channel.handle}"]`)
    await expect(sidebarOffline).toBeVisible({ timeout: 20_000 })
    await expect(sidebarLive).toHaveCount(0)
  } finally {
    obs?.kill('SIGKILL')
    await creator.endIfLive().catch(() => undefined)
    await creator.setStream('E2E', null).catch(() => undefined)
    await creator.dispose()
  }
})

test('M4 search page and Browse filters keep their state in the URL', async ({ page }) => {
  await page.goto('/search?q=lien%20minh')
  await expect(page.getByTestId('search-title')).toHaveText('Kết quả cho "lien minh"')
  await page.getByRole('tab', { name: 'Danh mục' }).click()
  await expect(page).toHaveURL(/type=category/)

  await page.goto('/browse?group=GAMES&view=categories')
  await expect(page.getByRole('button', { name: 'Games', pressed: true })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Danh mục', checked: true })).toBeVisible()
  await expect(page.getByTestId('browse-category-grid').getByTestId('category-card').first()).toBeVisible()

  // A segment that cannot be a handle is the channel 404, not a crash.
  await page.goto('/studio-not-a-route-handle-xx')
  await expect(page.getByTestId('profile-not-found')).toBeVisible()
})
