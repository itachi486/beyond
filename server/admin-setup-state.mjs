import { adminAllowedEmail } from "./auth.mjs";
// Coarse, secret-free onboarding information. This never authorizes a session.
export function initialAdminState(db, env = process.env) {
  const allowed = adminAllowedEmail(env);
  if (!allowed)
    return { state: "configuration_required", method: "local_command" };
  const count = db.prepare("SELECT COUNT(*) n FROM admins").get().n;
  if (count === 0)
    return { state: "initial_setup_required", method: "local_command" };
  const matching = db
    .prepare(
      "SELECT COUNT(*) n FROM admins WHERE email=? AND password_hash IS NOT NULL AND length(password_hash)>0",
    )
    .get(allowed).n;
  return {
    state: count === 1 && matching === 1 ? "ready" : "operator_review_required",
    method: "local_command",
  };
}
