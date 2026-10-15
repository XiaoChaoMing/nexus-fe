import type { ChildProcess } from 'node:child_process'
import { expect, test, type BrowserContext } from '@playwright/test'
import { goLive, registerAccount, signIn, waitForMail } from './gd5-helpers.ts'
import { apiContext, APP_URL, hasFfmpeg, linkFromMail } from './helpers.ts'
import { CreatorV4 } from './m4-helpers.ts'

/**
 * M4 Notifications (working plan GĐ5 WP10, §11): a verified viewer follows the seed channel with the bell on
 * "Tất cả" → the creator goes live → the bell count rises within seconds over `user:{id}`, the live toast shows,
 * Mailpit gets the `[LIVE]` e-mail; opening the item reads it; the e-mail switch in /settings/notifications is
 * saved at once; the unsubscribe link of the e-mail works without an account. Needs the GĐ5 stack and ffmpeg.
 */

test.skip(!hasFfmpeg(), 'ffmpeg is needed to publish a stream')

test('M4 Notifications: follow with the bell on, go live → bell, toast, e-mail; settings; unsubscribe', async ({ browser }) => {
  test.setTimeout(480_000)
  const creator = await CreatorV4.open()
  const contexts: BrowserContext[] = []
  let obs: ChildProcess | undefined

  try {
    if (await creator.endIfLive()) await new Promise((r) => setTimeout(r, 31_000))
    const channel = await creator.channel()

    // A viewer with a verified address (e-mails only go to verified addresses).
    const viewer = await registerAccount('m4nv')
    const verify = await linkFromMail(viewer.email, '/verify-email')
    const api = await apiContext()
    const verified = await api.post('/v1/auth/verify-email', { data: { token: new URL(verify, APP_URL).searchParams.get('token') } })
    expect(verified.status(), 'verify e-mail').toBe(200)
    await api.dispose()

    const ctx = await signIn(browser, viewer.username, viewer.password)
    contexts.push(ctx)
    const page = await ctx.newPage()

    // Follow the channel and set its bell to "Tất cả".
    await page.goto(`/c/${channel.handle}`)
    await page.getByTestId('channel-header').getByTestId('follow-button').click()
    await expect(page.getByTestId('channel-header').getByTestId('follow-state')).toBeVisible()
    await page.getByTestId('channel-header').getByTestId('follow-bell').click()
    await page.getByRole('menuitemradio', { name: /Tất cả/ }).click()
    await expect(page.getByTestId('channel-header').getByTestId('follow-bell')).toHaveAttribute('aria-label', /Tất cả/)

    // On the home page with no unread notification yet.
    await page.goto('/')
    await expect(page.getByTestId('notification-bell')).toHaveAttribute('aria-label', 'Thông báo')
    await expect(page.getByTestId('bell-count')).toHaveCount(0)

    // The creator goes live: bell +1 within seconds, the live toast, then the e-mail.
    const live = await goLive(creator, 'M4 Notif')
    obs = live.obs
    const liveAt = Date.now()
    await expect(page.getByTestId('bell-count')).toHaveText('1', { timeout: 15_000 })
    console.log(`bell after ${Date.now() - liveAt} ms from the stream listed as live`)
    await expect(page.getByTestId('notification-bell')).toHaveAttribute('aria-label', 'Thông báo, 1 chưa đọc')
    const toast = page.getByTestId('live-toast')
    await expect(toast).toContainText(`${channel.displayName} đang phát`)
    await expect(toast).toContainText(live.title)
    await expect(toast.getByRole('button', { name: 'Xem' })).toBeVisible()

    const mail = await waitForMail(viewer.email, /^\[LIVE\]/)
    expect(mail.subject).toContain(live.title)
    const unsubscribe = `${mail.text}\n${mail.html}`.match(/https?:\/\/[^\s"'<>]*\/notifications\/unsubscribe\?token=[^\s"'<>]+/)
    expect(unsubscribe, 'unsubscribe link in the e-mail').toBeTruthy()

    // Popover: the item is unread; opening it reads it and goes to the stream.
    await page.getByTestId('notification-bell').click()
    const popover = page.getByTestId('notification-popover')
    const item = popover.getByTestId('notification-item').filter({ hasText: `${channel.displayName} đang phát: ${live.title}` })
    await expect(item).toHaveAttribute('data-read', 'false')
    await item.getByRole('button').first().click()
    await expect(page).toHaveURL(new RegExp(`/live/${live.stream.id}$`))
    await expect(page.getByTestId('bell-count')).toHaveCount(0)

    // The center: read now; "Chưa đọc" is empty.
    await page.goto('/notifications')
    await expect(page.getByTestId('notification-item').filter({ hasText: live.title })).toHaveAttribute('data-read', 'true')
    await page.getByRole('tab', { name: 'Chưa đọc' }).click()
    await expect(page.getByTestId('notifications-empty')).toContainText('Không có thông báo chưa đọc')

    // Settings: turning the live e-mail off is saved at once and survives a reload.
    await page.goto('/settings/notifications')
    const email = page.getByTestId('setting-CREATOR_LIVE-email')
    await expect(email).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('setting-SYSTEM-inApp')).toBeDisabled()
    await email.click()
    await expect(page.getByText('Đã lưu')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('setting-CREATOR_LIVE-email')).toHaveAttribute('aria-checked', 'false')
    await page.getByTestId('setting-CREATOR_LIVE-email').click()
    await expect(page.getByTestId('setting-CREATOR_LIVE-email')).toHaveAttribute('aria-checked', 'true')

    // Unsubscribe from the e-mail, as a guest; a broken token is refused.
    const guest = await browser.newContext({ baseURL: APP_URL, locale: 'vi-VN' })
    contexts.push(guest)
    const unsub = await guest.newPage()
    const target = new URL(unsubscribe![0].replace(/&amp;/g, '&'))
    await unsub.goto(target.pathname + target.search)
    await expect(unsub.getByTestId('unsubscribe-page')).toContainText('Bạn sẽ không nhận email loại này nữa')
    await expect(unsub.getByTestId('unsubscribe-page')).toContainText('Đã tắt email “Kênh đang phát”')
    expect(unsub.url()).not.toContain('token=')
    await page.reload()
    await expect(page.getByTestId('setting-CREATOR_LIVE-email')).toHaveAttribute('aria-checked', 'false')
    await unsub.goto('/notifications/unsubscribe?token=broken')
    await expect(unsub.getByTestId('unsubscribe-page')).toContainText('Liên kết hủy nhận không hợp lệ hoặc đã hết hiệu lực')
  } finally {
    obs?.kill('SIGKILL')
    await creator.endIfLive().catch(() => false)
    for (const c of contexts) await c.close()
    await creator.dispose()
  }
})
