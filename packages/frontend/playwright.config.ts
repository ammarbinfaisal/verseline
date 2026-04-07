import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 4001;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `cd ${process.cwd()}/../backend && bun run src/index.ts`,
      port: BACKEND_PORT,
      reuseExistingServer: true,
      timeout: 15_000,
      env: {
        FRONTEND_URL: `http://localhost:${FRONTEND_PORT}`,
        PORT: String(BACKEND_PORT),
        ALLOW_SIGNUP: "true",
        GEO_BLOCK_ENABLED: "false",
      },
    },
    {
      command: "bun run dev",
      port: FRONTEND_PORT,
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${BACKEND_PORT}`,
      },
    },
  ],
});
