import { expect, test } from '@playwright/test'
import { approveApplicationOf, freshStreamKey, hasFfmpeg, linkFromMail, publish, uniqueUser, openLiveFromHome } from './helpers.ts'

/**
 * M1 (working plan GĐ1 §12): register in the modal → verify the email from Mailpit → apply as a Creator →
 * the seed admin approves (as nexuslive-admin would) → the channel is created and the Studio opens.
 * Needs the whole stack behind the edge (make nxl-up-all) with the dev seed and Mailpit.
 */
test('guest registers, verifies email, applies, gets approved and reaches the Studio', async ({ page }) => {
  test.setTimeout(300_000)
  const user = uniqueUser('m1')

  // Guest → "Phát trực tiếp" → modal → register tab (with the 13+/terms checkbox).
  await page.goto('/')
  await page.getByRole('button', { name: 'Phát trực tiếp' }).click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await modal.getByRole('tab', { name: 'Đăng ký' }).click()
  await modal.getByLabel('Tên người dùng').fill(user.username)
  await modal.getByLabel('Email').fill(user.email)
  await modal.getByLabel('Mật khẩu', { exact: true }).fill(user.password)
  await modal.getByLabel('Nhập lại mật khẩu').fill(user.password)
  await modal.getByRole('checkbox').check()
  await modal.getByRole('button', { name: 'Đăng ký', exact: true }).click()

  // The pending "go live" action runs once: a fresh viewer lands on the Creator application.
  await expect(modal).toBeHidden()
  await expect(page).toHaveURL(/\/creator\/apply$/)
  expect(await page.evaluate(() => sessionStorage.getItem('nxl.pendingAction'))).toBeNull()
  await expect(page.getByTestId('verify-banner')).toBeVisible()

  // Verification mail → link → verified (within 10 s of the click, AC M1).
  const verifyPath = await linkFromMail(user.email, '/verify-email?token=')
  await page.goto(verifyPath)
  await expect(page.getByRole('heading', { name: 'Email đã được xác minh' })).toBeVisible({ timeout: 10_000 })
  await expect(page).toHaveURL(/\/verify-email$/) // the token left the address bar

  // Creator application.
  await page.getByRole('link', { name: 'Nộp đơn Creator' }).click()
  await expect(page).toHaveURL(/\/creator\/apply$/)
  const form = page.getByTestId('creator-form')
  await form.getByLabel('Họ tên pháp lý').fill('Nguyễn Văn E2E')
  await form.getByLabel('Ngày sinh').fill('1999-05-20')
  await form.getByRole('checkbox').check()
  await form.getByRole('button', { name: 'Nộp đơn' }).click()
  await expect(page.getByTestId('creator-pending')).toBeVisible()

  // The seed admin approves through the admin API.
  await approveApplicationOf(user.email)

  // The page notices the approval, waits for the channel, then opens the Studio.
  await expect(page).toHaveURL(/\/studio\/stream$/, { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Phát trực tiếp' })).toBeVisible()
  await expect(page.getByTestId('studio-not-creator')).toHaveCount(0)
  await expect(page.getByTestId('channel-name').first()).toHaveText(user.username, { timeout: 30_000 })

  const key = await freshStreamKey(page)

  if (!hasFfmpeg()) {
    test.info().annotations.push({ type: 'skipped-publish', description: 'ffmpeg not on PATH' })

    return
  }

  // Go live and check that the watch page names the channel.
  const title = `M1 ${user.username}`
  await page.getByRole('textbox', { name: 'Tiêu đề' }).fill(title)
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
  const obs = publish(key, 90)
  try {
    await expect(page.getByTestId('studio-status').getByText('Live', { exact: true })).toBeVisible({ timeout: 30_000 })
    const viewer = await page.context().newPage()
    await viewer.goto('/')
    await openLiveFromHome(viewer, title)
    await expect(viewer.getByRole('heading', { name: title })).toBeVisible()
    await expect(viewer.getByTestId('channel-name').first()).toHaveText(user.username)

    await page.getByRole('button', { name: 'Kết thúc buổi phát' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Kết thúc' }).click()
    await expect(page.getByTestId('studio-status').getByText('Offline')).toBeVisible({ timeout: 15_000 })
  } finally {
    obs.kill('SIGKILL')
  }
})
