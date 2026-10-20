import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:1421",
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: ".venv\\Scripts\\python.exe scripts/e2e-server.py",
      url: "http://127.0.0.1:8011/api/health",
      timeout: 60000,
      reuseExistingServer: false,
    },
    {
      command: "npm run dev --workspace apps/desktop -- --port 1421",
      url: "http://127.0.0.1:1421",
      env: { VITE_API_URL: "http://127.0.0.1:8011" },
      timeout: 60000,
      reuseExistingServer: false,
    },
  ],
});
