import type { CSSProperties } from "react";
export default function CosmosInterface({
  es,
  author,
  busy,
  actions,
}: {
  es: boolean;
  author: boolean;
  busy: boolean;
  actions: (() => void)[];
}) {
  const paths = [
    "M12 1v22M1 12h22M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 7l1.8 3.2L17 12l-3.2 1.8L12 17l-1.8-3.2L7 12l3.2-1.8z",
    "M10 2Q10 10 2 10Q10 10 10 18Q10 10 18 10Q10 10 10 2ZM19 13Q19 18 14 18Q19 18 19 23Q19 18 24 18Q19 18 19 13ZM20 1v5M17.5 3.5h5",
    "M12 3v18M12 9Q6 9 6 5M12 15Q5 15 5 19M12 8Q18 8 19 4M12 16Q19 16 19 20M10 3a2 2 0 1 0 4 0a2 2 0 1 0-4 0M3 5a2 2 0 1 0 4 0a2 2 0 1 0-4 0M17 4a2 2 0 1 0 4 0a2 2 0 1 0-4 0M3 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    "M5 2h14v20l-7-4-7 4V2ZM12 5l-1.2 2.5-2.8.4 2 2-.5 2.8 2.5-1.3 2.5 1.3-.5-2.8 2-2-2.8-.4L12 5Z",
    "M5 20a5 5 0 0 1-1-9a7 7 0 0 1 13-3a6 6 0 0 1 2 12h-4v-7h3l-6-6-6 6h3v7H5Z",
    "M10 1h4l.7 3 2 .8 2.6-1.6 2.8 2.8-1.6 2.6.8 2 3 .7v4l-3 .7-.8 2 1.6 2.6-2.8 2.8-2.6-1.6-2 .8-.7 3h-4l-.7-3-2-.8-2.6 1.6L1.9 20l1.6-2.6-.8-2-3-.7v-4l3-.7.8-2L1.9 5.4l2.8-2.8 2.6 1.6 2-.8L10 1ZM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z",
  ];
  const labels = es
    ? [
        "Explore",
        "Biblioteca central",
        "Conectar espíritus",
        "Guardar",
        author ? "Subir personaje" : "Añadir personaje",
        "Configuración",
      ]
    : [
        "Explore",
        "Central Library",
        "Connect spirits",
        "Save",
        author ? "Upload Character" : "Add character",
        "Settings",
      ];
  return (
    <div className="cosmos-interface">
      <div className="cosmos-wordmark">
        <svg
          className="cosmos-emblem"
          viewBox="0 0 60 70"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <path d="M30 1l5 25 23 9-23 5-5 29-5-29-23-5 23-9 5-25ZM30 12v46M10 35h40M19 20l22 30M42 20L19 50M30 26l7 9-7 9-7-9 7-9Z" />
          <path d="M14 29l4-9 5 6M37 26l5-6 4 9M17 42l2 9 6-9M35 42l7 9 2-9" />
        </svg>
        <div>
          BEYOND<small>INFINITE COSMOS</small>
        </div>
      </div>
      <nav className="cosmos-toolbar" aria-label="Cosmos actions">
        {labels.map((label, i) => (
          <button
            key={label}
            className={i === 0 ? "is-current" : ""}
            aria-label={label}
            title={label}
            disabled={i === 3 && busy}
            onClick={actions[i]}
            style={
              {
                "--cosmos-accent": [
                  "#68c6ff",
                  "#c19aff",
                  "#86e7de",
                  "#e9c47d",
                  "#8caaff",
                  "#b7c8fa",
                ][i],
              } as CSSProperties
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <path
                d={paths[i]}
                fill={i >= 3 ? "currentColor" : "none"}
                fillRule="evenodd"
                strokeWidth={i >= 3 ? 0.5 : 1.4}
              />
            </svg>
          </button>
        ))}
      </nav>
    </div>
  );
}
