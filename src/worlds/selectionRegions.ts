export type SelectionRegion = {
  key: string;
  color: string;
  accent?: string;
  center: [number, number];
  title: [number, number];
  polygon: [number, number][];
};
/** Normalized coordinates traced against the supplied 1672 × 941 reference, not a card grid. */
export const selectionRegions: SelectionRegion[] = [
  {
    key: "what-if",
    color: "#f5ca71",
    center: [0.12, 0.49],
    title: [0.15, 0.17],
    polygon: [
      [0.005, 0.19],
      [0.19, 0.15],
      [0.235, 0.58],
      [0.27, 0.73],
      [0.19, 0.98],
      [0.005, 0.98],
    ],
  },
  {
    key: "human-mind",
    color: "#c4a1ff",
    center: [0.326, 0.385],
    title: [0.32, 0.18],
    polygon: [
      [0.254, 0.215],
      [0.395, 0.215],
      [0.44, 0.55],
      [0.31, 0.64],
      [0.218, 0.53],
    ],
  },
  {
    key: "unsolved",
    color: "#afcbf6",
    accent: "#e9c77e",
    center: [0.491, 0.38],
    title: [0.49, 0.6],
    polygon: [
      [0.448, 0.15],
      [0.535, 0.15],
      [0.58, 0.53],
      [0.44, 0.62],
      [0.41, 0.47],
    ],
  },
  {
    key: "hidden-worlds",
    color: "#68f3cb",
    center: [0.656, 0.45],
    title: [0.65, 0.2],
    polygon: [
      [0.594, 0.255],
      [0.727, 0.23],
      [0.754, 0.55],
      [0.695, 0.68],
      [0.569, 0.61],
    ],
  },
  {
    key: "your-future",
    color: "#72dfff",
    center: [0.869, 0.32],
    title: [0.85, 0.15],
    polygon: [
      [0.78, 0.065],
      [0.999, 0.03],
      [0.999, 0.54],
      [0.77, 0.56],
      [0.731, 0.4],
    ],
  },
  {
    key: "never-knew",
    color: "#ffd08a",
    accent: "#edf4ff",
    center: [0.867, 0.78],
    title: [0.83, 0.6],
    polygon: [
      [0.81, 0.52],
      [0.999, 0.52],
      [0.999, 0.99],
      [0.697, 0.99],
      [0.719, 0.69],
    ],
  },
];
