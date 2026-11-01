import { useEffect, useRef, useState } from "react";
import "./discovery-space.css";
const places = [
  {
    x: 19,
    y: 32,
    glyph: "◈",
    name: "Echo",
    text: "Something here remembers a light that has not arrived.",
  },
  {
    x: 69,
    y: 23,
    glyph: "✧",
    name: "A small beginning",
    text: "A distant spark. A place to begin again.",
  },
  {
    x: 46,
    y: 56,
    glyph: "⌁",
    name: "Undercurrent",
    text: "Beneath the silence, another current moves.",
  },
  {
    x: 81,
    y: 69,
    glyph: "◇",
    name: "The other side",
    text: "Every edge is the beginning of somewhere else.",
  },
  {
    x: 24,
    y: 78,
    glyph: "∴",
    name: "Constellation",
    text: "Separate lights. An unexpected connection.",
  },
  {
    x: 55,
    y: 85,
    glyph: "⊙",
    name: "Still here",
    text: "Even the quietest corner holds a little warmth.",
  },
];
export default function DiscoverySpace() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef({ x: -1000, y: -1000 });
  const ripple = useRef({ x: 0, y: 0, at: -10000 });
  const [active, setActive] = useState<number | null>(null);
  const [found, setFound] = useState<number[]>([]);
  const state = useRef({ active, found });
  state.current = { active, found };
  const redraw = useRef<() => void>(() => {});
  useEffect(() => {
    const element = canvas.current,
      ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    let frame = 0,
      width = innerWidth,
      height = innerHeight,
      last = -1000;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    function draw(now: number) {
      if (now - last < 33 && !motion.matches) return;
      last = now;
      ctx!.clearRect(0, 0, width, height);
      const time = motion.matches ? 0 : now / 1000;
      for (let i = 0; i < 85; i++) {
        const x =
          ((i * 0.618033989) % 1) * width + Math.sin(time * 0.08 + i) * 6;
        const y =
          ((i * 0.414213562) % 1) * height + Math.cos(time * 0.06 + i) * 5;
        const d = Math.hypot(pointer.current.x - x, pointer.current.y - y);
        const pull = Math.max(0, 1 - d / 140);
        ctx!.fillStyle = `rgba(166,199,220,${0.1 + (Math.sin(time * 0.45 + i) + 1) * 0.09 + pull * 0.3})`;
        ctx!.beginPath();
        ctx!.arc(
          x + (pointer.current.x - x) * pull * 0.05,
          y + (pointer.current.y - y) * pull * 0.05,
          i % 11 === 0 ? 1.1 : 0.6,
          0,
          Math.PI * 2,
        );
        ctx!.fill();
      }
      places.forEach((place, i) => {
        const x = (width * place.x) / 100,
          y = (height * place.y) / 100;
        const proximity = Math.max(
          0,
          1 - Math.hypot(pointer.current.x - x, pointer.current.y - y) / 170,
        );
        const known = state.current.found.includes(i);
        const radius = 24 + proximity * 55;
        const light = ctx!.createRadialGradient(x, y, 0, x, y, radius);
        light.addColorStop(
          0,
          `rgba(135,195,207,${0.035 + proximity * 0.19 + (known ? 0.05 : 0)})`,
        );
        light.addColorStop(1, "rgba(93,131,169,0)");
        ctx!.fillStyle = light;
        ctx!.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      });
      if (!motion.matches) {
        const age = (now - ripple.current.at) / 1300;
        if (age >= 0 && age < 1) {
          ctx!.strokeStyle = `rgba(183,211,202,${(1 - age) * 0.24})`;
          ctx!.lineWidth = 0.6;
          ctx!.beginPath();
          ctx!.arc(
            ripple.current.x,
            ripple.current.y,
            10 + age * 100,
            0,
            Math.PI * 2,
          );
          ctx!.stroke();
        }
      }
    }
    function tick(now: number) {
      if (!document.hidden) draw(now);
      frame = requestAnimationFrame(tick);
    }
    function resize() {
      width = innerWidth;
      height = innerHeight;
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      element!.width = width * ratio;
      element!.height = height * ratio;
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(performance.now());
    }
    function start() {
      cancelAnimationFrame(frame);
      resize();
      if (!motion.matches) frame = requestAnimationFrame(tick);
    }
    redraw.current = () => {
      if (motion.matches) draw(performance.now());
    };
    start();
    window.addEventListener("resize", resize);
    motion.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      motion.removeEventListener("change", start);
      redraw.current = () => {};
    };
  }, []);
  useEffect(() => redraw.current(), [active, found]);
  function discover(index: number) {
    setFound((old) => (old.includes(index) ? old : [...old, index]));
    setActive((old) => (old === index ? null : index));
  }
  return (
    <main
      className="discovery-space"
      aria-label="BEYOND discovery space"
      onPointerMove={(event) => {
        pointer.current = { x: event.clientX, y: event.clientY };
        redraw.current();
      }}
      onPointerLeave={() => {
        pointer.current = { x: -1000, y: -1000 };
        redraw.current();
      }}
      onPointerDown={(event) => {
        pointer.current = { x: event.clientX, y: event.clientY };
        ripple.current = {
          x: event.clientX,
          y: event.clientY,
          at: performance.now(),
        };
        redraw.current();
      }}
      onClick={(event) => {
        if (
          event.target === event.currentTarget ||
          event.target === canvas.current
        )
          setActive(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setActive(null);
      }}
    >
      <canvas ref={canvas} aria-hidden="true" />
      {places.map((place, i) => (
        <button
          key={place.name}
          className={`discovery-point${found.includes(i) ? " is-found" : ""}${active === i ? " is-open" : ""}`}
          style={{ left: `${place.x}%`, top: `${place.y}%` }}
          aria-label={place.name}
          aria-expanded={active === i}
          aria-controls={active === i ? "discovery-fragment" : undefined}
          onFocus={() => {
            pointer.current = {
              x: (innerWidth * place.x) / 100,
              y: (innerHeight * place.y) / 100,
            };
            redraw.current();
          }}
          onClick={() => discover(i)}
        >
          <span aria-hidden="true">
            {found.includes(i) ? place.glyph : "·"}
          </span>
        </button>
      ))}
      {active !== null && (
        <section
          id="discovery-fragment"
          className={`discovery-fragment${places[active].y > 65 ? " is-lower" : ""}`}
          role="status"
          aria-live="polite"
          style={{
            left: `${Math.max(28, Math.min(72, places[active].x))}%`,
            top: `${places[active].y}%`,
          }}
        >
          <span className="discovery-glyph" aria-hidden="true">
            {places[active].glyph}
          </span>
          <h1>{places[active].name}</h1>
          <p>{places[active].text}</p>
        </section>
      )}
    </main>
  );
}
