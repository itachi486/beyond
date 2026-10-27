import { openStore } from "./store.mjs";
import { createInitialAdmin } from "./auth.mjs";
import { createInterface } from "node:readline/promises";
const email = process.argv[2];
if (!email) {
  console.error(
    "Usage: npm run admin:setup -- admin@example.com (password is read privately from stdin)",
  );
  process.exit(1);
}
let password = "";
if (process.stdin.isTTY) {
  process.stdout.write("Administrator password (12+ characters; hidden): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  password = await new Promise((resolve, reject) => {
    let value = "";
    const read = (buffer) => {
      for (const c of buffer.toString()) {
        if (c === "\u0003") {
          process.stdin.off("data", read);
          reject(Error("Cancelled."));
          return;
        }
        if (c === "\n" || c === "\r") {
          process.stdin.off("data", read);
          resolve(value);
          return;
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    process.stdin.on("data", read);
  }).finally(() => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\n");
  });
} else {
  const input = createInterface({ input: process.stdin });
  for await (const line of input) {
    password = line;
    input.close();
    break;
  }
}
const db = openStore();
try {
  await createInitialAdmin(db, email, password);
  console.log(
    "Initial administrator created. No password or hash was printed.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  password = "";
  db.close();
}
