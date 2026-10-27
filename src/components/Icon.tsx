export function Icon({
  name,
}: {
  name: "compass" | "bookmark" | "menu" | "close" | "globe" | "arrow" | "trail";
}) {
  const paths = {
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m16 7-3 6-6 4 3-6z" />
      </>
    ),
    bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
    close: <path d="m5 5 14 14M5 19 19 5" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18M5 6h14M5 18h14" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    trail: (
      <>
        <circle cx="5" cy="5" r="2" />
        <circle cx="19" cy="19" r="2" />
        <path d="M7 5h7a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h8" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
