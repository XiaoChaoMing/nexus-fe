import { defineConfig, devices } from '@playwright/test'

/**
 * E2E against the real stack (identity :8090, stream :8092, media :1935/:8091, MinIO :9000) started
 * separately, e.g. `make nxl-up-all` (edge) or `make nxl-media-up` in nexuslive-be. The dev server is started here.
 * E2E_PUBLISH_CMD (optional) publishes a test stream with the key the test creates.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    // Selectors use the Vietnamese copy; the UI follows the browser language on first visit.
    locale: 'vi-VN',
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], locale: 'vi-VN' } }],
  webServer: {
    command: 'pnpm dev --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
