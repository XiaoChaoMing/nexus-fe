import { expect, test, type Page } from '@playwright/test'
import { freshStreamKey, publish, SEED_CREATOR, SEED_PASSWORD, openLiveFromHome } from './helpers.ts'

/**
 * Creator + viewer journey of the core livestream (L3). Needs the backend stack and ffmpeg on PATH
 * (ffmpeg plays OBS). Playback checks run only where the browser decodes H.264 (Chrome, not the
 * open-source Chromium bundled with Playwright). Since GĐ1 the Studio needs a channel, so the publisher is
 * the dev seed creator (creator@nexuslive.dev).
 */

async function canDecodeH264(page: Page) {
  return page.evaluate(() => 'MediaSource' in window && MediaSource.isTypeSupported('video/mp4; codecs="avc1.4d401f,mp4a.40.2"'))
}

test('creator goes live, viewer watches, creator ends, replay is offered', async ({ page }) => {
  test.setTimeout(300_000)
  const user = `e2e${Date.now().toString(36)}`
  const login = await page.request.post('/v1/auth/login', { data: { login: SEED_CREATOR, password: SEED_PASSWORD } })
  expect(login.status()).toBe(200)

  // Studio: a leftover broadcast of an earlier run is ended first (then the 30 s end cooldown passes).
  await page.goto('/studio/stream')
  await expect(page.getByTestId('studio-status')).toBeVisible({ timeout: 30_000 })
  const endLeftover = page.getByRole('button', { name: 'Kết thúc buổi phát' })
  if (await endLeftover.isVisible()) {
    await endLeftover.click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Kết thúc' }).click()
    await expect(page.getByTestId('studio-status').getByText('Offline')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(31_000)
  }

  // Create the key (shown once; regenerated when the seed channel already has one) and set the title.
  const key = await freshStreamKey(page)

  const title = `E2E ${user}`
  await page.getByRole('textbox', { name: 'Tiêu đề' }).fill(title)
  await page.getByRole('textbox', { name: 'Tag' }).fill('e2e, test, e2e')
  await expect(page.getByRole('button', { name: 'Bỏ tag e2e' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Bỏ tag test' })).toBeVisible()
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(page.getByRole('region', { name: /Notifications/ }).getByText('Đã lưu thông tin buổi phát')).toBeVisible()

  let obs = publish(key, 120)

  try {
    const status = page.getByTestId('studio-status')
    await expect(status.getByText('Live', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('studio-health').getByText(/Ổn định|Cần chú ý/)).toBeVisible({ timeout: 20_000 })

    // Viewer: home grid → watch page.
    const viewer = await page.context().newPage()
    await viewer.goto('/')
    // GĐ5: signed URLs live under /hls/t/{expires}/{md5}/streams/{id}/.
    const manifestResponse = viewer.waitForResponse((r) => r.url().includes('/hls/') && r.url().includes('/streams/') && r.url().includes('master.m3u8'))
    await openLiveFromHome(viewer, title)
    await expect(viewer.getByRole('heading', { name: title })).toBeVisible()
    await expect(viewer).toHaveURL(/\/live\/[0-9a-f-]{36}$/)
    // GĐ1: the watch page names the channel instead of a raw id.
    await expect(viewer.getByTestId('channel-name').first()).toBeVisible()
    const watchUrl = viewer.url()

    expect((await manifestResponse).status()).toBe(200)

    if (await canDecodeH264(viewer)) {
      const player = viewer.getByTestId('player')
      await expect(player).toHaveAttribute('data-state', 'live', { timeout: 30_000 })

      // Quality: "Tự động (…)" + three renditions.
      await viewer.getByRole('button', { name: /^Chất lượng/ }).click()
      await expect(viewer.getByRole('menuitemradio', { name: /^Tự động/ })).toBeVisible()
      for (const q of ['720p', '480p', '360p']) await expect(viewer.getByRole('menuitemradio', { name: q, exact: true })).toBeVisible()
      await viewer.getByRole('menuitemradio', { name: '480p', exact: true }).click()
      await expect(viewer.getByRole('button', { name: 'Chất lượng: 480p' })).toBeVisible()

      // DVR: wait for some history, rewind 10 s, then back to live.
      await viewer.waitForTimeout(16_000)
      await player.hover()
      await viewer.keyboard.press('ArrowLeft')
      await expect(viewer.getByTestId('behind-label')).toBeVisible()
      await viewer.getByRole('button', { name: 'Về trực tiếp' }).click()
      await expect(viewer.getByTestId('live-badge')).toHaveAttribute('data-at-live', 'true')
    } else {
      test.info().annotations.push({ type: 'skipped-playback', description: 'browser cannot decode H.264 (use Chrome via E2E_CHROMIUM_PATH)' })
    }

    // OBS drops → interrupted on both pages; reconnect → same stream continues.
    obs.kill('SIGKILL')
    await expect(status.getByText('Gián đoạn')).toBeVisible({ timeout: 20_000 })
    await expect(viewer.getByText('Tạm gián đoạn').first()).toBeVisible({ timeout: 15_000 })

    obs = publish(key, 120)
    await expect(status.getByText('Live', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(viewer).toHaveURL(watchUrl)

    // Creator ends the broadcast.
    await page.getByRole('button', { name: 'Kết thúc buổi phát' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Kết thúc' }).click()
    await expect(status.getByText('Offline')).toBeVisible({ timeout: 15_000 })

    // OBS auto-reconnect right after End must not start a new broadcast (30 s cooldown).
    obs.kill('SIGKILL')
    obs = publish(key, 15)
    await page.waitForTimeout(8_000)
    await expect(status.getByText('Offline')).toBeVisible()

    // A new visitor is offered the replay once the VOD is ready, and the replay page opens.
    const late = await page.context().newPage()
    await late.goto(watchUrl)
    await expect(late.getByTestId('ended-screen')).toBeVisible()
    const replay = late.getByRole('link', { name: 'Xem lại' })
    await expect(replay).toBeVisible({ timeout: 30_000 })
    await replay.click()
    await expect(late).toHaveURL(/\/vod\/[0-9a-f-]{36}$/)
    await expect(late.getByRole('heading', { name: title })).toBeVisible()
    await expect(late.getByText(/Hết hạn sau \d+ ngày/)).toBeVisible()

    if (await canDecodeH264(late)) {
      // Watch a little, leave, come back: the page offers to resume.
      await expect(late.getByTestId('player')).toHaveAttribute('data-state', 'live', { timeout: 30_000 })
      await late.waitForTimeout(8_000)
      await late.reload()
      await expect(late.getByTestId('vod-resume')).toBeVisible()
      await late.getByRole('button', { name: 'Xem tiếp' }).click()
      await expect(late.getByTestId('player')).toBeVisible()
    }
  } finally {
    obs.kill('SIGKILL')
  }
})
