import {useAccount} from '../account/AccountProvider';
import {currentUserId,captureAccountContext,isAccountContextCurrent} from '../account/sessionScope';
import { useEffect, useState } from "react";
// This is a capability read from the existing server session, never a local role flag.
let inFlight:{epoch:number;promise:Promise<boolean>}|null=null;
export function verifyAuthor():Promise<boolean>{const ctx=captureAccountContext();if(currentUserId()&&!currentUserId()!.startsWith('admin-personal-'))return Promise.resolve(false);if(!inFlight||inFlight.epoch!==ctx.authEpoch){const entry={epoch:ctx.authEpoch,promise:readAuthor().then(allowed=>isAccountContextCurrent(ctx)&&allowed)};inFlight=entry;void entry.promise.finally(()=>{if(inFlight===entry)inFlight=null;});}return inFlight.promise;}
async function readAuthor() {
  const scope=currentUserId();
  try {
    const response = await fetch("/api/admin/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return false;
    const session = await response.json();
    return (
      typeof session.csrf === "string" && typeof session.email === "string" && (!scope || session.personalPrincipalId===scope)
    );
  } catch {
    return false;
  }
}
export async function requireAuthor() {
  if (!(await verifyAuthor())) throw Error("admin_author_required");
}
export function useAuthorAccess() {
  const account=useAccount();
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if(account.loading||(account.user&&account.user.kind!=='administrator')){setAllowed(false);return;}
    let live = true;
    const check = () =>
      void verifyAuthor().then((value) => {
        if (live) setAllowed(value);
      });
    check();
    window.addEventListener("focus", check);
    return () => {
      live = false;
      window.removeEventListener("focus", check);
    };
  }, [account.loading,account.user?.id]);
  return allowed;
}

export async function requiresPersonalCloud(){const r=await fetch('/api/admin/session',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('Administrator session could not be confirmed.');const s=await r.json();return s.personalWorldsRequired===true;}
