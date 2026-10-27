// Used only by isolated browser QA. No application route invokes this module.
import { openStore } from "./store.mjs";
import { createInitialAdmin } from "./auth.mjs";
export async function bootstrapTestDatabase(file, password) {
  if (!file.includes("beyond-admin-e2e-"))
    throw Error("Expected disposable test path.");
  const db = openStore(file);
  try {
    await createInitialAdmin(db, "editor@example.test", password);
  } finally {
    db.close();
  }
}
