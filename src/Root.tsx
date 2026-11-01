import AccountProvider,{useAccount} from "./features/account/AccountProvider";
import AccountPages from "./features/account/AccountPages";
import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import App from "./App";
import { UniverseProvider } from "./features/content/UniverseProvider";
const DiscoverySpace = lazy(
  () => import("./features/discovery/DiscoverySpace"),
);
const AdminApp = lazy(() => import("./admin/AdminApp"));
function Routes() {
  const path = useLocation().pathname;
  const {epoch}=useAccount();
  if (["/register","/login","/forgot-password","/verify-email","/reset-password","/recover-account","/account","/my-worlds"].includes(path)) return <AccountPages/>;
  if (path === "/discover")
    return (
      <Suspense fallback={null}>
        <DiscoverySpace key={epoch}/>
      </Suspense>
    );
  if (path === "/admin" || path.startsWith("/admin/"))
    return (
      <Suspense
        fallback={<p className="content-loading">Opening workspace…</p>}
      >
        <AdminApp key={epoch}/>
      </Suspense>
    );
  return (
    <UniverseProvider key={epoch}>
      <App />
    </UniverseProvider>
  );
}

export default function Root(){return <AccountProvider><Routes/></AccountProvider>;}
