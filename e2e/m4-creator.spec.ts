import type { ChildProcess } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { apiContext, apiRegister, hasFfmpeg, publish, SEED_CREATOR, SEED_PASSWORD, uniqueUser } from './helpers.ts'
import { CreatorV4, localDateTime, signedIn, solidPng } from './m4-helpers.ts'

/**
 * GĐ4 Creator journey (working plan WP10, §11): the seed creator edits the channel (bio + avatar) in Studio →
 * creates a one-off schedule a few minutes ahead → a viewer sets a reminder on the profile's Lịch tab → the
 * watch page shows "Sắp diễn ra" with the countdown → the creator goes live and the same page switches to the
 * player (same streamId, no reload) → the VOD is ready → the creator hides it in Studio → Nội dung → it is gone
 * from the profile and its direct URL answers 404 to others.
 * Needs the whole stack (channel-svc schedule job at 1 min, stream-svc SCHEDULED rows) and ffmpeg.
 */

type Occurrence = { scheduleId: string; occurrenceAt: string; title: string; streamId: string | null }

test.skip(!hasFfmpeg(), 'ffmpeg is needed to publish a stream')

test('M4 creator: profile + avatar → schedule → reminder → Upcoming → go live attaches → VOD → hide → gone', async ({ browser }) => {
  test.setTimeout(600_000)
  const creator = await CreatorV4.open()
  const tz = await creator.timezone()
  let obs: ChildProcess | undefined
  let scheduleId = ''

  try {
    if (await creator.endIfLive()) await new Promise((r) => setTimeout(r, 31_000))
    const channel = await creator.channel()
    const studioCtx = await signedIn(browser, SEED_CREATOR, SEED_PASSWORD, tz)
    const studio = await studioCtx.newPage()

    // 1. Studio → Kênh: avatar (uploaded at once) and bio (Save bar).
    await studio.goto('/studio/channel')
    await expect(studio.getByTestId('channel-form')).toBeVisible({ timeout: 30_000 })
    await studio.getByTestId('upload-avatar-input').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: solidPng(300, 300, [0, 245, 155]) })
    await expect(studio.getByText('Đã cập nhật ảnh đại diện')).toBeVisible({ timeout: 20_000 })
    const bio = `Bio E2E ${Date.now().toString(36)}`
    await studio.getByTestId('channel-bio-input').fill(bio)
    await expect(studio.getByTestId('save-bar')).toBeVisible()
    await studio.getByTestId('channel-save').click()
    await expect(studio.getByText('Đã lưu hồ sơ kênh')).toBeVisible()

    // The profile shows the new bio.
    await studio.goto(`/c/${channel.handle}?tab=about`)
    await expect(studio.getByTestId('channel-bio')).toHaveText(bio)

    // 2. Studio → Lịch phát: a one-off broadcast ~4 minutes ahead (well inside the −30 / +60 min Go Live window).
    await studio.goto('/studio/schedule')
    await studio.getByTestId('schedule-create').first().click()
    const form = studio.getByTestId('schedule-form')
    const title = `M4 schedule ${Date.now().toString(36)}`
    const at = localDateTime(Date.now() + 4 * 60_000, tz)
    await form.getByTestId('schedule-title').fill(title)
    await form.getByTestId('schedule-date').fill(at.date)
    await form.getByTestId('schedule-time').fill(at.time)
    await form.getByTestId('schedule-submit').click()
    await expect(studio.getByText('Đã tạo lịch')).toBeVisible()
    await expect(studio.getByTestId('schedule-row').filter({ hasText: title })).toBeVisible()

    // The schedule job announces the broadcast (≤ 24 h ahead) → stream-svc creates the SCHEDULED row.
    let occ: Occurrence | undefined
    await expect(async () => {
      const res = await creator.api.get(`/v1/channels/${channel.id}/schedule`)
      const items = ((await res.json()) as { data: { items: Occurrence[] } }).data.items
      occ = items.find((o) => o.title === title && o.streamId)
      expect(occ?.streamId, 'scheduled stream id').toBeTruthy()
    }).toPass({ timeout: 180_000, intervals: [5_000] })
    scheduleId = occ!.scheduleId
    const streamId = occ!.streamId!

    // 3. A viewer sets a reminder on the Lịch tab, then opens the watch page: "Sắp diễn ra".
    const viewer = uniqueUser('m4c')
    const api = await apiContext()
    await apiRegister(api, viewer)
    await api.dispose()
    const viewerCtx = await signedIn(browser, viewer.username, viewer.password)
    const page = await viewerCtx.newPage()
    await page.goto(`/c/${channel.handle}?tab=schedule`)
    const card = page.getByTestId('schedule-card').filter({ hasText: title })
    await expect(card).toBeVisible()
    await card.getByTestId('remind-button').click()
    await expect(page.getByText(/Đã đặt nhắc cho buổi phát lúc/)).toBeVisible()
    await expect(card.getByTestId('remind-button')).toHaveText(/Đã đặt nhắc/)

    await page.goto(`/live/${streamId}`)
    const stage = page.getByTestId('upcoming-stage')
    await expect(stage).toBeVisible()
    await expect(stage.getByTestId('upcoming-countdown')).toContainText(/\d{2}:\d{2}:\d{2}/)
    await expect(stage.getByTestId('remind-button')).toHaveText(/Đã đặt nhắc/)
    await expect(page.getByTestId('chat-not-open').first()).toContainText('Chat mở khi buổi phát bắt đầu')

    // 4. Go Live inside the window: the same stream row goes LIVE and the page switches without a reload.
    await creator.setStream(title, null)
    const key = await creator.streamKey()
    obs = publish(key, 90)
    await expect(page.getByTestId('player')).toBeVisible({ timeout: 60_000 })
    await expect(page).toHaveURL(new RegExp(`/live/${streamId}$`))
    const live = await creator.studio()
    expect(live.current?.streamId, 'Go Live attached to the scheduled row').toBe(streamId)

    // 5. End → VOD.
    await new Promise((r) => setTimeout(r, 20_000))
    await creator.endIfLive()
    obs.kill('SIGKILL')
    let vodId = ''
    await expect(async () => {
      const res = await creator.api.get(`/v1/streams/${streamId}`, { headers: creator.headers })
      vodId = ((await res.json()) as { data: { vodId: string | null } }).data.vodId ?? ''
      expect(vodId, 'VOD id').not.toBe('')
    }).toPass({ timeout: 150_000, intervals: [5_000] })

    // 6. Studio → Nội dung: hide the VOD.
    await studio.goto('/studio/content')
    const row = studio.locator(`[data-testid="studio-vod-row"][data-vod="${vodId}"]`)
    await expect(row).toBeVisible({ timeout: 30_000 })
    await row.getByTestId('vod-actions').last().click()
    await studio.getByRole('menuitem', { name: 'Ẩn' }).click()
    await expect(studio.getByText('Đã ẩn bản xem lại. Người xem không còn thấy video này.')).toBeVisible()

    // 7. Gone from the profile (Video tab) and 404 for anyone but the owner.
    await page.goto(`/c/${channel.handle}?tab=videos`)
    await expect(page.locator(`a[href="/vod/${vodId}"]`)).toHaveCount(0)
    const guest = await apiContext()
    expect((await guest.get(`/v1/vods/${vodId}`)).status()).toBe(404)
    await guest.dispose()
    expect((await creator.api.get(`/v1/vods/${vodId}`, { headers: creator.headers })).status()).toBe(200)

    await viewerCtx.close()
    await studioCtx.close()
  } finally {
    obs?.kill('SIGKILL')
    await creator.endIfLive().catch(() => undefined)
    if (scheduleId) await creator.api.delete(`/v1/studio/schedules/${scheduleId}`, { headers: creator.headers }).catch(() => undefined)
    await creator.dispose()
  }
})
