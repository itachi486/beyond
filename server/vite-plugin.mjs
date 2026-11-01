import { posix, resolve, dirname, relative } from "node:path";
import { loadEnv } from "vite";
import { openStore } from "./store.mjs";
import { createAPI } from "./api.mjs";
function attachBackend(server) {
  const env = loadEnv(server.config.mode, server.config.envDir, [
    "BEYOND_DB_PATH",
    "BEYOND_ASSET_DIR",
    "APP_ORIGIN",
    "ADMIN_ALLOWED_EMAIL",
    "AI_IMAGE_",
    "OPENAI_API_KEY",
  ]);
  const assetDirectory = resolve(
    env.BEYOND_ASSET_DIR ||
      resolve(
        dirname(resolve(env.BEYOND_DB_PATH || ".local/beyond.sqlite")),
        "character-assets",
      ),
  );
  const assetRelative = relative(server.config.root, assetDirectory)
    .split("\\")
    .join("/");
  const assetURL =
    assetRelative && !assetRelative.startsWith("..")
      ? "/" + assetRelative
      : null;
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
      (assetURL && (path === assetURL || path.startsWith(assetURL + "/"))) ||
      path.split("/").includes("character-assets") ||
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
      aiEnv: { ...process.env, ...env },
      authEnv: { ...process.env, ...env },
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
