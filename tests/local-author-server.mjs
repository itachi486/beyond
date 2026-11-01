// Disposable browser-QA backend. Never points at the operator's database or secrets.
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { bootstrapTestDatabase } from "../server/test-bootstrap.mjs";
const dir = mkdtempSync(join(tmpdir(), "beyond-admin-e2e-public-"));
const credentials = process.env.BEYOND_QA_CREDENTIALS;
if (!credentials?.startsWith(join(tmpdir(), "beyond-qa-")))
  throw Error("Missing private test credential channel");
const password = randomBytes(24).toString("base64url"),
  email = "editor@example.test",
  origin = "http://127.0.0.1:5178";
await bootstrapTestDatabase(join(dir, "test.sqlite"), password);
writeFileSync(
  credentials,
  JSON.stringify({
    email,
    password,
    origin,
    database: join(dir, "test.sqlite"),
  }),
  {
    mode: 0o600,
    flag: "wx",
  },
);
const child = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5178",
    "--strictPort",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      BEYOND_DB_PATH: join(dir, "test.sqlite"),
      BEYOND_ASSET_DIR: join(dir, "character-assets"),
      ADMIN_ALLOWED_EMAIL: email,
      APP_ORIGIN: origin,
      OPENAI_API_KEY: "",
      AI_IMAGE_PROVIDER: "none",
    },
  },
);
let exiting = false;
function stop() {
  if (exiting) return;
  exiting = true;
  child.kill("SIGTERM");
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("exit", (code) => {
  rmSync(credentials, { force: true });
  rmSync(dir, { recursive: true, force: true });
  process.exit(code || 0);
});
