import type { ChildProcess } from 'node:child_process'
import { expect, test, type BrowserContext } from '@playwright/test'
import { AdminApi, goLive } from './gd5-helpers.ts'
import { APP_URL, hasFfmpeg } from './helpers.ts'
import { CreatorV4 } from './m4-helpers.ts'

/**
 * Takedown (TSD GĐ5 S7, §11): an Admin takes down a live broadcast → the watch page switches in place to
 * "Buổi phát đã bị gỡ do vi phạm quy định" (no replay, chat read-only); opened again later it is
 * "Nội dung này không còn khả dụng". Needs the GĐ5 stack and ffmpeg.
 */

test.skip(!hasFfmpeg(), 'ffmpeg is needed to publish a stream')

test('Takedown: the watch page shows "Đã bị gỡ" in place, then "không còn khả dụng"', async ({ browser }) => {
  test.setTimeout(300_000)
  const creator = await CreatorV4.open()
  const admin = await AdminApi.open()
  const contexts: BrowserContext[] = []
  let obs: ChildProcess | undefined

  try {
    const live = await goLive(creator, 'Takedown')
    obs = live.obs
    const ctx = await browser.newContext({ baseURL: APP_URL, locale: 'vi-VN' })
    contexts.push(ctx)
    const page = await ctx.newPage()
    await page.goto(`/live/${live.stream.id}`)
    await expect(page.getByTestId('chat-column')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('video')).toBeAttached()

    const at = Date.now()
    await admin.takedown(live.stream.id)
    await expect(page.getByTestId('taken-down')).toContainText('Buổi phát đã bị gỡ do vi phạm quy định', { timeout: 10_000 })
    console.log(`taken down on screen after ${Date.now() - at} ms`)
    await expect(page.locator('video')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Xem lại' })).toHaveCount(0)
    await expect(page.getByTestId('chat-input')).toHaveAttribute('placeholder', 'Buổi phát đã kết thúc — chat chỉ đọc')

    await page.reload()
    await expect(page.getByTestId('live-unavailable')).toContainText('Nội dung này không còn khả dụng')
    await expect(page.getByTestId('chat-column')).toHaveCount(0)
  } finally {
    obs?.kill('SIGKILL')
    await creator.endIfLive().catch(() => false)
    for (const c of contexts) await c.close()
    await creator.dispose()
    await admin.dispose()
  }
})
