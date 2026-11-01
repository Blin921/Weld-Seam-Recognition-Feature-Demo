import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./static-demo",
  testMatch: "offline.spec.ts",
  workers: 1,
  use: { viewport: { width: 1366, height: 768 } },
});
