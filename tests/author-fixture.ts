import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
// Real server login into a disposable test database, not a mocked authorization flag.
export async function authorizeLocalAuthor(page: Page) {
  const file = process.env.BEYOND_QA_CREDENTIALS;
  if (!file) throw Error("Missing isolated browser-author fixture");
  const { email, password, origin, database } = JSON.parse(
    readFileSync(file, "utf8"),
  );
  if (!database?.includes("beyond-admin-e2e-public-"))
    throw Error("Expected disposable database");
  // Test isolation only: rate-limit behavior itself is covered by server/auth tests.
  const db = new DatabaseSync(database);
  db.prepare("DELETE FROM login_limits").run();
  db.close();
  const response = await page.request.post(origin + "/api/admin/login", {
    headers: { Origin: origin },
    data: { email, password },
  });
  if (response.status() !== 200) throw Error("Disposable author login failed");
}
