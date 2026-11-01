import type { ObjectKind } from "./worldStore";
export function ObjectArt({ kind }: { kind: ObjectKind }) {
  switch (kind) {
    case "crystal":
      return (
        <>
          <path
            d="M0 -70 28 -15 16 40 0 62 -22 25 -30 -10Z"
            fill="#90c9f1"
            stroke="#e9e0ff"
            strokeWidth="2"
          />
          <path d="M0 -70 4 -7 0 62 -12 -10Z" fill="#d6a2ed" />
          <path
            d="M-30 -10 4 -7 28 -15M4 -7 16 40"
            fill="none"
            stroke="#fff7cc"
          />
          <ellipse cy="61" rx="44" ry="9" fill="none" stroke="#dfb86c" />
        </>
      );
    case "portal":
      return (
        <>
          <path
            d="M-48 54V-5a48 56 0 0 1 96 0v59"
            fill="#153d55"
            stroke="#98aa9b"
            strokeWidth="13"
          />
          <ellipse
            cy="5"
            rx="32"
            ry="46"
            fill="#165c77"
            stroke="#8affef"
            strokeWidth="3"
          />
          <ellipse cy="5" rx="23" ry="35" fill="#173459" stroke="#a5e4ff" />
          <path d="m-18 14 18-28 15 25-19 18Z" fill="none" stroke="#66ffda" />
          <path d="M-58 57H58M-63 65H63" stroke="#a4b6b1" strokeWidth="7" />
        </>
      );
    case "tree":
      return (
        <>
          <path
            d="M-8 62 0-20 12 62M0 7-32-20M3-4 32-35"
            stroke="#887054"
            strokeWidth="8"
            fill="none"
          />
          {[
            [-26, -23],
            [0, -48],
            [28, -30],
            [-36, 1],
            [32, 1],
          ].map(([x, y], i) => (
            <path
              key={i}
              d={`M${x} ${y - 27}q-40 25-5 48q45 4 5-48Z`}
              fill={i % 2 ? "#377d77" : "#245f58"}
              stroke="#85b695"
            />
          ))}
          <path d="M-22 65Q0 52 25 66" stroke="#899c78" fill="none" />
        </>
      );
    case "ruin":
      return (
        <>
          <path d="M-63 55H63L45 68H-49Z" fill="#696e80" />
          {[-43, -8, 28].map((x, i) => (
            <g key={x}>
              <path
                d={`M${x} 53v-${60 + i * 12}l15-8 8 10v${58 + i * 12}Z`}
                fill="#8c92a2"
                stroke="#c0bda8"
              />
              <path
                d={`M${x - 3} ${-15 - i * 12}h29`}
                stroke="#cebc8b"
                strokeWidth="6"
              />
            </g>
          ))}
          <path
            d="M-57 37 24 22M-40 47 39 34"
            stroke="#528776"
            strokeWidth="3"
          />
        </>
      );
    case "island":
      return (
        <>
          <path
            d="M-88 0-52-26 12-32 82-8 65 20 30 80-8 105-35 56-69 36Z"
            fill="#35435b"
            stroke="#8a959e"
          />
          <path d="M-88 0-52-26 12-32 82-8 51 19-21 22Z" fill="#507d70" />
          <path
            d="M-38 21-8 94 16 21M35 23 29 77"
            stroke="#85918b"
            fill="none"
          />
          <path
            d="M52 16 47 81 40 105"
            stroke="#83d9e8"
            strokeWidth="6"
            opacity=".7"
          />
        </>
      );
    case "door":
      return (
        <>
          <path
            d="M-35 61v-92q35-35 70 0v92Z"
            fill="#3d335a"
            stroke="#d3b47f"
            strokeWidth="8"
          />
          <path
            d="M-23 54v-79q23-23 46 0v79Z"
            fill="#123f52"
            stroke="#79d8ce"
          />
          <path d="M0-20V44M-18 8H18" stroke="#567d9e" />
          <circle cx="15" cy="20" r="3" fill="#ffe0a0" />
        </>
      );
    case "orb":
      return (
        <>
          <circle r="38" fill="#277e97" stroke="#c0f9ff" strokeWidth="3" />
          <circle cx="-8" cy="-10" r="21" fill="#9adbe6" opacity=".65" />
          <ellipse
            rx="59"
            ry="13"
            transform="rotate(-25)"
            fill="none"
            stroke="#dfbe83"
            strokeWidth="2"
          />
          <circle cx="-50" cy="20" r="5" fill="#f8e0a3" />
        </>
      );
    default:
      return (
        <>
          <path d="M-67 58H67V69H-67Z" fill="#7a8594" />
          <path
            d="M-60-16 0-68 60-16Z"
            fill="#526a88"
            stroke="#d8ba7a"
            strokeWidth="3"
          />
          {[-44, -14, 16, 42].map((x) => (
            <path key={x} d={`M${x}-12v68`} stroke="#abb8c1" strokeWidth="11" />
          ))}
          <path d="M-60-14H60M-63 55H63" stroke="#d8ba7a" strokeWidth="7" />
        </>
      );
  }
}
