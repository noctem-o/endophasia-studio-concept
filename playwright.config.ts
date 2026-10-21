import { defineConfig } from '@playwright/test';

/**
 * Browser smoke suite. Small on purpose: it asserts what jsdom cannot (that the SVG backend really attaches and draws, that WebGL2
 * really renders, that hit-testing agrees with what is drawn, that the modal drawer really traps focus) and it fails, with
 * screenshots and traces, when it does not.
 *
 *   npm run test:e2e          builds, serves the production build with `vite preview`, runs the suite at DPR 1 and DPR 2
 *
 * Environment (all optional):
 *   E2E_PORT              preview port (default 4173)
 *   E2E_CHROMIUM_PATH     use this Chromium instead of Playwright's own (for machines where `playwright install` is not possible)
 *   E2E_REQUIRE_WEBGL=1   fail, instead of skipping the WebGL tests, when WebGL2 cannot initialise (CI sets this)
 */
const port = Number(process.env.E2E_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: !!process.env.CI,
  retries: 0, // a flaky browser test is a defect to fix, not to retry
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: process.env.E2E_CHROMIUM_PATH || undefined,
      // Software GL, so WebGL2 can initialise without a GPU. This tests correctness, never hardware performance.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    { name: 'dpr1', use: { deviceScaleFactor: 1 } },
    { name: 'dpr2', use: { deviceScaleFactor: 2 } },
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
