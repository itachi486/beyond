import {
  createContext,
  useContext,
  useEffect,
  useState,
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
  useEffect(() => {
    let active = true;
    let revision = 0;
    const load = async () => {
      const current = ++revision;
      try {
        const response = await fetch("/api/public/universe", {
          cache: "no-store",
        });
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("application/json")
        )
          throw Error();
        const next = await response.json();
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
          setData(null);
          setError("The universe could not be loaded. Please retry.");
        }
      }
    };
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
          <button onClick={() => location.reload()}>Retry / Reintentar</button>
        )}
      </main>
    );
  return <Context.Provider value={data}>{children}</Context.Provider>;
}
