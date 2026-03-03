import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  // reporter: 'html',
  
  // Run a local server before starting the tests
  webServer: {
    command: 'pnpm run preview:e2e', // We will define this script next
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Safari is critical for analytics testing (ITP / strict implementation)
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }, 
  ],
});