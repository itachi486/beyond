import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
process.env.BEYOND_QA_CREDENTIALS ||= join(
  tmpdir(),
  "beyond-qa-" + randomUUID() + ".json",
);
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/member-accounts.spec.ts", "**/world-companion.spec.ts"], // Separate disposable Cloudflare adapter configuration.
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5178",
    headless: true,
    launchOptions: {
      args: [
        "--enable-webgl",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    command: "exec node tests/local-author-server.mjs",
    url: "http://127.0.0.1:5178",
    reuseExistingServer: false,
    gracefulShutdown:{signal:'SIGTERM',timeout:5000},
  },
  timeout: 45000,
});
