import { openStore } from "./store.mjs";
import {
  adminAllowedEmail,
  createInitialAdmin,
  normalizeEmail,
} from "./auth.mjs";
import { readSetupPasswords } from "./setup-password.mjs";
let db,
  password = "",
  confirmation = "";
try {
  const allowed = adminAllowedEmail();
  if (!allowed)
    throw Error(
      "Configure one valid ADMIN_ALLOWED_EMAIL in .env.local, then restart setup. Nothing was registered.",
    );
  const email =
    process.argv[2] === undefined ? allowed : normalizeEmail(process.argv[2]);
  if (email !== allowed)
    throw Error(
      "The requested email is not authorized. Nothing was registered.",
    );
  db = openStore();
  if (db.prepare("SELECT 1 FROM admins LIMIT 1").get())
    throw Error(
      "An administrator already exists. Initial setup is disabled; existing credentials were preserved.",
    );
  console.log(
    "One-time local administrator setup. No public registration endpoint is available.",
  );
  [password, confirmation] = await readSetupPasswords();
  if (password !== confirmation)
    throw Error("Passwords do not match. Nothing was registered.");
  await createInitialAdmin(db, email, password);
  console.log(
    "Initial administrator created. Sign in at /admin/login using your configured email and chosen password.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  password = "";
  confirmation = "";
  db?.close();
}
