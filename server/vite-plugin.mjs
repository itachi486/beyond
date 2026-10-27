import { posix } from "node:path";
import { loadEnv } from "vite";
import { openStore } from "./store.mjs";
import { createAPI } from "./api.mjs";
function attachBackend(server) {
  const env = loadEnv(server.config.mode, server.config.envDir, [
    "BEYOND_DB_PATH",
    "APP_ORIGIN",
  ]);
  let db;
  const getDB = () => db || (db = openStore(env.BEYOND_DB_PATH));
  server.middlewares.use((req, res, next) => {
    let path;
    try {
      path = posix.normalize(
        decodeURIComponent(new URL(req.url || "/", "http://local").pathname),
      );
    } catch {
      res.statusCode = 400;
      res.end();
      return;
    }
    if (
      path === "/.local" ||
      path.startsWith("/.local/") ||
      path.startsWith("/server/") ||
      path.startsWith("/@fs/") ||
      path.startsWith("/.env")
    ) {
      res.statusCode = 404;
      res.end();
      return;
    }
    if (!path.startsWith("/api/") && !path.startsWith("/admin")) {
      next();
      return;
    }
    const port = req.socket.localPort || server.config.server.port || 5173;
    const api = createAPI(getDB(), {
      origin:
        env.APP_ORIGIN ||
        (req.headers.origin === `http://127.0.0.1:${port}`
          ? `http://127.0.0.1:${port}`
          : `http://localhost:${port}`),
    });
    void api(req, res, next);
  });
  server.httpServer?.once("close", () => db?.close());
}
export function beyondBackend() {
  return {
    name: "beyond-local-backend",
    configureServer: attachBackend,
    configurePreviewServer: attachBackend,
  };
}
