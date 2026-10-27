import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openStore } from "./store.mjs";
import { createAPI } from "./api.mjs";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};
export function startServer({
  db = openStore(),
  port = Number(process.env.PORT || 4173),
  origin = process.env.APP_ORIGIN || `http://localhost:${port}`,
  production = process.env.NODE_ENV === "production",
} = {}) {
  const root = resolve("dist"),
    api = createAPI(db, { origin, production });
  const server = createServer((req, res) => {
    void api(req, res, () => {
      void (async () => {
        if (!["GET", "HEAD"].includes(req.method)) {
          res.writeHead(405);
          res.end();
          return;
        }
        let path;
        try {
          path = decodeURIComponent(new URL(req.url, "http://local").pathname);
        } catch {
          res.writeHead(400);
          res.end();
          return;
        }
        const target = resolve(root, "." + path);
        if (!target.startsWith(root + sep) && target !== root) {
          res.writeHead(404);
          res.end();
          return;
        }
        if (
          path.includes("/.") ||
          path.startsWith("/server") ||
          path.startsWith("/.local")
        ) {
          res.writeHead(404);
          res.end();
          return;
        }
        let file = target;
        try {
          if (!(await stat(file)).isFile()) file = resolve(root, "index.html");
        } catch {
          file = resolve(root, "index.html");
        }
        try {
          const content = await readFile(file);
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("Referrer-Policy", "same-origin");
          res.setHeader(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
          );
          res.setHeader("Cache-Control", "no-store");
          res.writeHead(200, {
            "Content-Type": types[extname(file)] || "application/octet-stream",
          });
          res.end(req.method === "HEAD" ? undefined : content);
        } catch {
          res.writeHead(503);
          res.end("Build the application before starting the server.");
        }
      })();
    });
  });
  server.listen(port, "127.0.0.1");
  return server;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = startServer();
  server.on("listening", () =>
    console.log("BEYOND server listening on configured local port."),
  );
}
