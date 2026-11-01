import { useEffect, useState } from "react";
import type { AdminRequest } from "./AdminInventory";
import PermanentDelete from "./PermanentDelete";
import { t, adminDate } from "./i18n";
export default function PendingDeletions({
  request,
}: {
  request: AdminRequest;
}) {
  const [jobs, setJobs] = useState<
      {
        id: string;
        kind: "character" | "world";
        version: number;
        createdAt: string;
      }[]
    >([]),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    request("deletion-jobs", "GET", undefined, c.signal)
      .then((v) => {
        if (!c.signal.aborted) setJobs(v.items);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [request, refresh]);
  if (error)
    return (
      <p className="admin-error" role="alert">
        {error}
      </p>
    );
  if (!jobs.length) return null;
  return (
    <section className="admin-panel">
      <h2>{t("pendingDeletion")}</h2>
      <p>{t("pendingExplanation")}</p>
      {jobs.map((j) => (
        <article key={j.id}>
          <code>{j.id}</code>
          <p>{adminDate(j.createdAt)}</p>
          <PermanentDelete
            {...j}
            name={j.id}
            request={request}
            onDeleted={() => setRefresh((v) => v + 1)}
          />
        </article>
      ))}
    </section>
  );
}
