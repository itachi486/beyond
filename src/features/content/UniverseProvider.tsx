import {readJSON} from '../../lib/apiResponse';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import "./content.css";
import type { Discovery, World } from "../../data/universe";
export interface Universe {
  worlds: World[];
  discoveries: Discovery[];
  connections: { from_id: string; to_id: string; explanation: string }[];
  defaultLanguage: "en" | "es";
}
const Context = createContext<Universe | null>(null);
export function useUniverse() {
  const data = useContext(Context);
  if (!data) throw Error("Universe data unavailable.");
  return data;
}
export function UniverseProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Universe | null>(null),
    [error, setError] = useState("");
  const reload=useRef<()=>void>(()=>{});
  useEffect(() => {
    let active = true;
    let revision = 0;
    const load = async () => {
      const current = ++revision;
      try {
        const next = await readJSON('/api/public/universe');
        if (!Array.isArray(next.worlds) || !Array.isArray(next.discoveries))
          throw Error();
        if (active && current === revision) {
          setData((old) =>
            JSON.stringify(old) === JSON.stringify(next) ? old : next,
          );
          setError("");
        }
      } catch {
        if (active && current === revision) {
          setError("The universe could not be loaded. Please retry.");
        }
      }
    };
    reload.current=()=>{void load();};
    void load();
    window.addEventListener("focus", load);
    window.addEventListener("beyond:content-changed", load);
    return () => {
      active = false;
      revision++;
      window.removeEventListener("focus", load);
      window.removeEventListener("beyond:content-changed", load);
    };
  }, []);
  if (!data)
    return (
      <main className="content-loading">
        <h1>BEYOND</h1>
        <p role="status">{error || "Opening the universe…"}</p>
        {error && (
          <button onClick={() => reload.current()}>Retry / Reintentar</button>
        )}
      </main>
    );
  return <Context.Provider value={data}>{error&&<aside role="alert">World information could not refresh. Your open world is preserved. <button onClick={()=>reload.current()}>Retry</button></aside>}{children}</Context.Provider>;
}
