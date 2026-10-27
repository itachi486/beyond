import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import App from "./App";
import { UniverseProvider } from "./features/content/UniverseProvider";
const AdminApp = lazy(() => import("./admin/AdminApp"));
export default function Root() {
  const path = useLocation().pathname;
  if (path === "/admin" || path.startsWith("/admin/"))
    return (
      <Suspense
        fallback={<p className="content-loading">Opening workspace…</p>}
      >
        <AdminApp />
      </Suspense>
    );
  return (
    <UniverseProvider>
      <App />
    </UniverseProvider>
  );
}
