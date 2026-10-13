import { expect, test } from '@playwright/test'
import { apiContext, apiRegister, SEED_CREATOR, SEED_PASSWORD, uniqueUser } from './helpers.ts'

/**
 * Guest mode (TSD GĐ1 S5, NXL-D BR-D10): a gated action opens the login modal on the current page, the action
 * is remembered in sessionStorage and runs exactly once after signing in. Needs the backend stack.
 */

const PENDING_KEY = 'nxl.pendingAction'

test('guest "Phát trực tiếp" → modal → viewer signs in → Creator application, once', async ({ page }) => {
  const user = uniqueUser('gm')
  // Created through a separate context, so the page stays a guest.
  const api = await apiContext()
  await apiRegister(api, user)
  await api.dispose()

  await page.goto('/')
  await page.getByRole('button', { name: 'Phát trực tiếp' }).click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await expect(page).toHaveURL(/\/$/) // the modal does not navigate
  expect(JSON.parse((await page.evaluate((k) => sessionStorage.getItem(k), PENDING_KEY)) ?? '{}')).toMatchObject({ type: 'goLive', returnTo: '/' })

  // Esc closes and forgets the action; opening again remembers it again.
  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
  expect(await page.evaluate((k) => sessionStorage.getItem(k), PENDING_KEY)).toBeNull()
  await page.getByRole('button', { name: 'Phát trực tiếp' }).click()

  await modal.getByLabel('Email hoặc tên người dùng').fill(user.username)
  await modal.getByLabel('Mật khẩu').fill(user.password)
  await modal.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

  await expect(modal).toBeHidden()
  await expect(page).toHaveURL(/\/creator\/apply$/)
  expect(await page.evaluate((k) => sessionStorage.getItem(k), PENDING_KEY)).toBeNull()

  // Runs once: going back home and reloading does not replay it.
  await page.goto('/')
  await page.reload()
  await expect(page.getByTestId('user-menu')).toBeVisible()
  await page.waitForTimeout(1_000)
  await expect(page).toHaveURL(/\/$/)
})

test('guest "Phát trực tiếp" → creator signs in → Studio', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Phát trực tiếp' }).click()
  const modal = page.getByRole('dialog')
  await modal.getByLabel('Email hoặc tên người dùng').fill(SEED_CREATOR)
  await modal.getByLabel('Mật khẩu').fill(SEED_PASSWORD)
  await modal.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

  await expect(page).toHaveURL(/\/studio\/stream$/)
  await expect(page.getByTestId('studio-status')).toBeVisible({ timeout: 20_000 })
})

test('deep link /login?returnTo= returns to an internal path only', async ({ page }) => {
  await page.goto('/login?returnTo=%2F%2Fevil.example')
  await page.getByLabel('Email hoặc tên người dùng').fill(SEED_CREATOR)
  await page.getByLabel('Mật khẩu').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(/localhost:5173\/$/)
})

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('bottom nav has five tabs and Profile opens the login sheet for guests', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByTestId('bottom-nav')
    await expect(nav).toBeVisible()
    for (const name of ['Trang chủ', 'Khám phá', 'Đang theo dõi', 'Tìm kiếm', 'Hồ sơ']) {
      await expect(nav.getByRole('link', { name })).toBeVisible()
    }

    await nav.getByRole('link', { name: 'Hồ sơ' }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
    // Bottom sheet: anchored to the bottom edge of the viewport.
    const box = await sheet.boundingBox()
    expect(box).not.toBeNull()
    expect(Math.round(box!.y + box!.height)).toBeGreaterThanOrEqual(843)

    // Signing in finishes the remembered action: the profile (account settings) opens.
    await sheet.getByLabel('Email hoặc tên người dùng').fill(SEED_CREATOR)
    await sheet.getByLabel('Mật khẩu').fill(SEED_PASSWORD)
    await sheet.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await expect(page).toHaveURL(/\/settings\/account$/)
  })
})
