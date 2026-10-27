import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
const COST = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const normalizeEmail = (v) =>
  typeof v === "string" ? v.trim().toLowerCase() : "";
export function validEmail(v) {
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
export function passwordPolicy(v) {
  return typeof v === "string" && v.length >= 12 && Buffer.byteLength(v) <= 256;
}
export async function hashPassword(password) {
  if (!passwordPolicy(password))
    throw Error("Use a password of 12–256 characters.");
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, COST);
  return `scrypt$32768$8$1$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password, hash) {
  if (typeof password !== "string" || Buffer.byteLength(password) > 256)
    return false;
  const parts = hash.split("$");
  if (parts.length !== 6) return false;
  const key = await scrypt(password, parts[4], 64, COST);
  const target = Buffer.from(parts[5], "hex");
  return target.length === key.length && timingSafeEqual(target, key);
}
export async function createInitialAdmin(db, email, password) {
  email = normalizeEmail(email);
  if (!validEmail(email)) throw Error("A valid email is required.");
  if (db.prepare("SELECT 1 FROM admins LIMIT 1").get())
    throw Error("An administrator already exists. Bootstrap is disabled.");
  const hash = await hashPassword(password);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (db.prepare("SELECT 1 FROM admins LIMIT 1").get())
      throw Error("An administrator already exists. Bootstrap is disabled.");
    db.prepare("INSERT INTO admins VALUES(?,?,?,?)").run(
      randomUUID(),
      email,
      hash,
      new Date().toISOString(),
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function cookieName(production) {
  return production ? "__Host-beyond_admin" : "beyond_admin";
}
export function findSession(db, request, production, now = Date.now()) {
  const cookie = request.headers.cookie || "";
  const token = cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName(production) + "="))
    ?.split("=")[1];
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return (
    db
      .prepare(
        "SELECT s.*,a.email FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE token_hash=? AND expires_at>?",
      )
      .get(digest(token), now) || null
  );
}
export function newSession(
  db,
  adminId,
  ttl = 8 * 60 * 60 * 1000,
  now = Date.now(),
) {
  const token = randomBytes(32).toString("base64url"),
    csrf = randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
  db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
    digest(token),
    adminId,
    csrf,
    now + ttl,
  );
  return { token, csrf, expiresAt: now + ttl };
}
export function cookie(token, production, maxAge = 8 * 60 * 60) {
  return `${cookieName(production)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production ? "; Secure" : ""}`;
}
