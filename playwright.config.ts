import { defineConfig, devices } from "@playwright/test";

// Reuses a running `pnpm dev` when E2E_PORT points at it (Next allows one dev server per project).
const PORT = Number(process.env.E2E_PORT ?? 3200);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], locale: "tr-TR" }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"], locale: "en-US" }, grep: /@mobile/ },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
