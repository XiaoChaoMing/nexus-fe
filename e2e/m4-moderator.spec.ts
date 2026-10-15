import type { ChildProcess } from 'node:child_process'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { AdminApi, chatLine, goLive, openLineMenu, openRoom, registerAccount, sendChat, signIn, type Account } from './gd5-helpers.ts'
import { APP_URL, hasFfmpeg, SEED_CREATOR, SEED_PASSWORD } from './helpers.ts'
import { CreatorV4 } from './m4-helpers.ts'

/**
 * M4 Moderator (working plan GĐ5 WP10, §11): the seed creator goes live and makes M a Moderator in Studio →
 * Cộng đồng; M deletes, pins, times out and bans viewer B from the chat (B and reporter R see it at once), lifts
 * the ban on /moderation/:channel, adds a blocked term and turns link blocking on (B is refused, M is not); R
 * reports B's message; the admin (API) locks B for 24 h → B's socket closes with 4003 and the locked screen shows;
 * R gets "Báo cáo của bạn đã được xử lý". Needs the whole GĐ5 stack and ffmpeg.
 */

/** Realtime changes reach other viewers within a second (§11); the CI margin is generous. */
const FAST = 3_000

test.skip(!hasFfmpeg(), 'ffmpeg is needed to publish a stream')

async function messageId(page: Page, text: string): Promise<string> {
  const id = await chatLine(page, text).getAttribute('data-message-id')
  expect(id).toBeTruthy()

  return id!
}

function lineById(page: Page, id: string) {
  return page.locator(`[data-testid="chat-message"][data-message-id="${id}"]`)
}

test('M4 Moderator: roles, delete, pin, timeout, ban, blocked terms, report, account lock', async ({ browser }) => {
  test.setTimeout(600_000)
  const creator = await CreatorV4.open()
  const admin = await AdminApi.open()
  const contexts: BrowserContext[] = []
  let obs: ChildProcess | undefined
  let channelId = ''
  let mod: Account | undefined

  try {
    const channel = await creator.channel()
    channelId = channel.id
    // Leave the seed channel's chat as other specs expect it, whatever an earlier run left behind.
    await creator.api.put(`/v1/channels/${channelId}/chat-settings`, { headers: creator.headers, data: { slowSec: 0, followersMin: null, subsOnly: false, blockLinks: false } })
    const terms = (await (await creator.api.get(`/v1/channels/${channelId}/blocked-terms`, { headers: creator.headers })).json()) as { data: { items: { id: string; term: string }[] } }
    for (const term of terms.data.items) await creator.api.delete(`/v1/channels/${channelId}/blocked-terms/${term.id}`, { headers: creator.headers })

    const live = await goLive(creator, 'M4 Mod')
    obs = live.obs
    const streamId = live.stream.id

    mod = await registerAccount('m4mod')
    const viewer = await registerAccount('m4vb')
    const reporter = await registerAccount('m4rep')

    // Creator: Studio → Cộng đồng → Moderator → add M.
    const creatorCtx = await signIn(browser, SEED_CREATOR, SEED_PASSWORD)
    contexts.push(creatorCtx)
    const studio = await creatorCtx.newPage()
    await studio.goto('/studio/community')
    await expect(studio.getByTestId('studio-community')).toBeVisible()
    await studio.getByTestId('role-input').fill(`@${mod.username}`)
    await studio.getByTestId('role-add').click()
    await expect(studio.getByText(`Đã thêm @${mod.username} làm Moderator`)).toBeVisible()
    await expect(studio.getByTestId('role-row').filter({ hasText: mod.username })).toBeVisible()
    await expect(studio.getByText('1/50 Moderator')).toBeVisible()

    // The three people in the room (M after the role exists, so the snapshot gives the tools).
    const mCtx = await signIn(browser, mod.username, mod.password)
    const bCtx = await signIn(browser, viewer.username, viewer.password)
    const rCtx = await signIn(browser, reporter.username, reporter.password)
    contexts.push(mCtx, bCtx, rCtx)
    const [m, b, r] = await Promise.all([mCtx.newPage(), bCtx.newPage(), rCtx.newPage()])
    await openRoom(b, streamId)
    await openRoom(r, streamId)
    // Role changes take up to 5 s (ROLE_CACHE_TTL): reload until the moderator menu is there.
    await expect(async () => {
      await openRoom(m, streamId)
      await expect(m.getByTestId('chat-input')).toBeEnabled({ timeout: 15_000 })
      await sendChat(m, `mod online ${Date.now().toString(36)}`)
      const probe = `probe ${Date.now().toString(36)}`
      await sendChat(b, probe)
      const menu = await openLineMenu(m, probe)
      await expect(menu.getByTestId('menu-delete')).toBeVisible({ timeout: 2_000 })
      await m.keyboard.press('Escape')
    }).toPass({ timeout: 60_000 })

    // Delete: B's line becomes "Tin nhắn đã bị xóa" for everyone, in place.
    const first = `vào link này nhận skin free ${Date.now().toString(36)}`
    await sendChat(b, first)
    await expect(chatLine(r, first)).toBeVisible({ timeout: FAST })
    const firstId = await messageId(m, first)
    await (await openLineMenu(m, first)).getByTestId('menu-delete').click()
    await expect(m.getByText('Đã xóa tin nhắn')).toBeVisible()
    for (const p of [b, r, m]) await expect(lineById(p, firstId).getByTestId('chat-deleted')).toHaveText('Tin nhắn đã bị xóa', { timeout: FAST })

    // Pin: the pinned bar shows for everyone; viewers get "Ẩn", the moderator "Bỏ ghim".
    const pinText = `Duo tối nay lúc 21:30 ${Date.now().toString(36)}`
    await sendChat(m, pinText)
    await expect(chatLine(m, pinText)).toHaveAttribute('data-delivery', 'DELIVERED')
    await (await openLineMenu(m, pinText)).getByTestId('menu-pin').click()
    for (const p of [b, r]) await expect(p.getByTestId('pinned-bar')).toContainText(pinText, { timeout: FAST })
    await expect(r.getByTestId('pinned-hide')).toHaveText('Ẩn')
    await expect(m.getByTestId('pinned-unpin')).toHaveText('Bỏ ghim')
    await r.getByTestId('pinned-hide').click()
    await expect(r.getByTestId('pinned-bar')).toHaveCount(0)
    await r.getByRole('button', { name: 'Hiện tin ghim' }).click()
    await expect(r.getByTestId('pinned-bar')).toBeVisible()

    // Timeout 1 minute: B's lines are cleared and B's input counts down; lifting it reopens the input.
    const second = `ai cần acc giá rẻ ib ${Date.now().toString(36)}`
    await sendChat(b, second)
    await expect(chatLine(r, second)).toBeVisible({ timeout: FAST })
    const secondId = await messageId(r, second)
    const menu = await openLineMenu(m, second)
    await menu.getByTestId('menu-timeout').hover()
    await m.getByTestId('timeout-60').click()
    await expect(m.getByText(`Đã timeout @${viewer.username} 1 phút`)).toBeVisible()
    await expect(lineById(r, secondId).getByTestId('chat-deleted')).toBeVisible({ timeout: FAST })
    await expect(b.getByTestId('chat-input')).toBeDisabled({ timeout: FAST })
    await expect(b.getByTestId('chat-input')).toHaveAttribute('placeholder', /^Bạn bị tạm khóa chat đến \d{2}:\d{2} · còn 0:\d{2}$/)

    // User card (moderator view): the restriction with its countdown, then "Gỡ timeout".
    const bName = lineById(m, secondId).getByRole('button', { name: viewer.username })
    await bName.click()
    const card = m.getByTestId('user-card')
    await expect(card).toBeVisible()
    await expect(card.getByTestId('card-restriction')).toContainText('Đang bị timeout · còn')
    await card.getByTestId('card-untimeout').click()
    await expect(m.getByText(`Đã gỡ timeout cho @${viewer.username}`)).toBeVisible()
    await expect(b.getByTestId('chat-input')).toBeEnabled({ timeout: FAST })

    // Ban from the card: Modal/Confirm Danger, then B can read but not send.
    await expect(card.getByTestId('card-ban')).toBeVisible()
    await card.getByTestId('card-ban').click()
    const ban = m.getByTestId('ban-dialog')
    await expect(ban).toContainText(`Cấm @${viewer.username} chat trong kênh này?`)
    await ban.getByLabel('Lý do (không bắt buộc)').fill('Spam link lừa đảo')
    await ban.getByTestId('ban-confirm').click()
    await expect(m.getByText(`Đã cấm @${viewer.username} chat trong kênh`)).toBeVisible()
    await expect(b.getByTestId('chat-input')).toHaveAttribute('placeholder', 'Bạn bị cấm chat trong kênh này', { timeout: FAST })
    await expect(b.getByTestId('chat-input')).toBeDisabled()
    // B still reads the room.
    const stillReading = `B vẫn đọc được ${Date.now().toString(36)}`
    await sendChat(r, stillReading)
    await expect(chatLine(b, stillReading)).toBeVisible({ timeout: FAST })

    // /moderation/:channel from the avatar menu: Bị cấm → "Bỏ cấm", then Từ khóa chặn + Chặn liên kết.
    const modPage = await mCtx.newPage()
    await modPage.goto('/')
    await modPage.getByTestId('user-menu').click()
    await modPage.getByTestId('moderated-channel').first().click()
    await expect(modPage).toHaveURL(new RegExp(`/moderation/${channel.handle}$`))
    await expect(modPage.getByTestId('moderation-page')).toContainText('Trang kiểm duyệt')
    const row = modPage.getByTestId('restriction-row').filter({ hasText: viewer.username })
    await expect(row).toContainText('Cấm')
    await expect(row).toContainText('Spam link lừa đảo')
    await modPage.getByTestId(`lift-${viewer.username}`).click()
    await expect(modPage.getByText(`Đã bỏ cấm @${viewer.username}`)).toBeVisible()
    await expect(b.getByTestId('chat-input')).toBeEnabled({ timeout: FAST })

    await modPage.getByRole('tab', { name: 'Từ khóa chặn' }).click()
    await modPage.getByTestId('term-input').fill('spam')
    await modPage.getByTestId('term-add').click()
    await expect(modPage.getByText('Đã thêm từ khóa')).toBeVisible()
    await expect(modPage.getByTestId('term-row').filter({ hasText: 'spam' })).toBeVisible()
    await modPage.getByTestId('block-links').click()
    await expect(modPage.getByTestId('block-links')).toHaveAttribute('aria-checked', 'true')

    // Auto-mod applies within 5 s (AUTOMOD_CACHE_TTL): B's "SPẢM" is refused (TERM), a link too (LINK).
    await expect(async () => {
      const spam = `SPẢM nè ${Date.now().toString(36)}`
      await sendChat(b, spam)
      await expect(chatLine(b, spam)).toHaveAttribute('data-delivery', 'BLOCKED', { timeout: 3_000 })
    }).toPass({ timeout: 30_000 })
    await expect(b.getByTestId('chat-notice')).toContainText('Tin nhắn không được gửi do vi phạm quy tắc kênh.')
    await expect(chatLine(b, 'SPẢM nè').getByTestId('chat-blocked')).toContainText('vi phạm quy tắc kênh')
    await expect(r.getByTestId('chat-message').filter({ hasText: 'SPẢM nè' })).toHaveCount(0)
    const link = `xem tại abc.xyz ${Date.now().toString(36)}`
    await sendChat(b, link)
    await expect(chatLine(b, link)).toHaveAttribute('data-delivery', 'BLOCKED')
    await expect(b.getByTestId('chat-notice')).toContainText('Kênh này không cho phép gửi liên kết.')
    // Moderators are exempt.
    const modSpam = `spam test từ mod ${Date.now().toString(36)}`
    await sendChat(m, modSpam)
    await expect(chatLine(r, modSpam)).toBeVisible({ timeout: FAST })

    // R reports B's message (⋯ → Báo cáo tin nhắn): reason, note, evidence line, toast.
    const evidence = `tin cần báo cáo ${Date.now().toString(36)}`
    await sendChat(b, evidence)
    await expect(chatLine(r, evidence)).toBeVisible({ timeout: FAST })
    const evidenceId = await messageId(r, evidence)
    await (await openLineMenu(r, evidence)).getByTestId('menu-report').click()
    const report = r.getByTestId('report-modal')
    await expect(report.getByRole('heading', { name: 'Báo cáo tin nhắn' })).toBeVisible()
    await expect(report.getByTestId('report-target')).toContainText(evidence)
    await expect(report).toContainText('Hệ thống tự đính kèm tối đa 10 tin nhắn gần nhất')
    await expect(report.getByTestId('report-submit')).toHaveAttribute('aria-disabled', 'true')
    await report.getByText('Spam', { exact: true }).click()
    await report.getByLabel('Ghi chú (không bắt buộc)').fill('Spam link lừa đảo liên tục')
    await report.getByTestId('report-submit').click()
    await expect(r.getByText('Cảm ơn bạn. Báo cáo đã được gửi tới đội ngũ quản trị.')).toBeVisible()
    await expect(report).toHaveCount(0)

    // Admin: lock B for 24 h with the report, then resolve it.
    const filed = await admin.reportOn(evidenceId)
    await admin.lockUser(viewer.id, 24, filed.id)
    await admin.resolve(filed.id)

    // B: the socket closes with 4003 → banner + locked input on the live page, video keeps playing.
    await expect(b.getByTestId('chat-banner')).toContainText('Tài khoản của bạn đã bị khóa', { timeout: 10_000 })
    await expect(b.getByTestId('chat-input')).toHaveAttribute('placeholder', 'Tài khoản của bạn đã bị khóa')
    // Leaving the live page inside the app opens the locked page (a reload signs out: the session is revoked).
    await b.locator('header a[href="/"]').first().click()
    await expect(b).toHaveURL(/\/account-locked/)
    await expect(b.getByTestId('account-locked')).toBeVisible()
    const fresh = await browser.newContext({ baseURL: APP_URL, locale: 'vi-VN' })
    contexts.push(fresh)
    const login = await fresh.newPage()
    await login.goto('/login')
    await login.getByLabel('Email hoặc tên người dùng').fill(viewer.username)
    await login.getByLabel('Mật khẩu').fill(viewer.password)
    await login.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await expect(login.getByTestId('account-locked')).toContainText(/Tài khoản tạm khóa tới \d{2}:\d{2}/)

    // R: "Báo cáo của bạn đã được xử lý" in the bell (realtime) and the popover.
    await expect(r.getByTestId('bell-count')).toBeVisible({ timeout: 15_000 })
    await r.getByTestId('notification-bell').click()
    const popover = r.getByTestId('notification-popover')
    await expect(popover.getByTestId('notification-item').filter({ hasText: 'Báo cáo của bạn đã được xử lý' })).toBeVisible()
  } finally {
    obs?.kill('SIGKILL')
    if (channelId) {
      await creator.api.put(`/v1/channels/${channelId}/chat-settings`, { headers: creator.headers, data: { slowSec: 0, followersMin: null, subsOnly: false, blockLinks: false } })
      const terms = (await (await creator.api.get(`/v1/channels/${channelId}/blocked-terms`, { headers: creator.headers })).json()) as { data?: { items: { id: string }[] } }
      for (const term of terms.data?.items ?? []) await creator.api.delete(`/v1/channels/${channelId}/blocked-terms/${term.id}`, { headers: creator.headers })
      if (mod) await creator.api.delete(`/v1/channels/${channelId}/roles/${mod.id}`, { headers: creator.headers })
    }
    await creator.endIfLive().catch(() => false)
    for (const c of contexts) await c.close()
    await creator.dispose()
    await admin.dispose()
  }
})
