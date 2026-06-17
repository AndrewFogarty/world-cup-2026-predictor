const { defineConfig } = require("@playwright/test");

// E2E config. Serves the static site, then drives a real browser.
// Run locally: npm i -D @playwright/test && npx playwright install chromium && npm run test:e2e
module.exports = defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:4173" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "PORT=4173 node scripts/serve.js",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
