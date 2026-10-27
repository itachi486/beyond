import { useEffect, useRef } from "react";

/** Ambient canvas is independent of React renders; the landing never requires WebGL. */
export function HeroScene({
  reduced,
  simple,
}: {
  reduced: boolean;
  simple: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const portal = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layer = root.current;
    const surface = canvas.current;
    if (!layer || !surface) return;
    let ctx: CanvasRenderingContext2D | null;
    try {
      ctx = surface.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) {
      // Keep a calm, usable static scene when Canvas itself is unavailable.
      layer.dataset.canvasUnavailable = "true";
      return () => {
        delete layer.dataset.canvasUnavailable;
      };
    }
    delete layer.dataset.canvasUnavailable;
    let width = 1,
      height = 1,
      frame = 0,
      lastFrame = 0,
      start = 0;
    let centerX = 0.88,
      centerY = 0.43;
    let pointerX = 0,
      pointerY = 0,
      smoothX = 0,
      smoothY = 0;
    let seed = 481;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    // Stratification gives every screen region distant stars, even on mobile.
    const stars = Array.from({ length: simple ? 52 : 115 }, (_, index) => ({
      x: ((index % 3) + 0.08 + random() * 0.84) / 3,
      y: ((Math.floor(index / 3) % 3) + 0.08 + random() * 0.84) / 3,
      radius: 0.55 + random() * 1.25,
      phase: random() * Math.PI * 2,
      period: 5 + random() * 9,
      depth: 0.3 + random() * 0.7,
    }));
    const sparks = Array.from({ length: simple ? 12 : 28 }, () => ({
      phase: random(),
      angle: random() * Math.PI * 2,
      depth: 0.45 + random() * 0.55,
    }));
    // A bounded foreground layer is spread equally across all nine regions.
    const dust = Array.from({ length: simple ? 18 : 36 }, (_, index) => ({
      x: ((index % 3) + 0.22 + random() * 0.56) / 3,
      y: ((Math.floor(index / 3) % 3) + 0.22 + random() * 0.56) / 3,
      phase: random() * Math.PI * 2,
      speed: (index % 2 ? -1 : 1) * (0.75 + random() * 0.5),
      radius: 0.8 + random() * 1.2,
      depth: 1.2 + random() * 0.7,
    }));
    function resize() {
      const rect = layer!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const ratio = Math.min(devicePixelRatio || 1, simple ? 1 : 1.5);
      surface!.width = Math.round(width * ratio);
      surface!.height = Math.round(height * ratio);
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      const bounds = portal.current?.getBoundingClientRect();
      if (bounds) {
        centerX = (bounds.left + bounds.width / 2 - rect.left) / width;
        centerY = (bounds.top + bounds.height / 2 - rect.top) / height;
      }
      if (reduced) draw(0, 0);
    }
    function draw(seconds: number, dt: number) {
      if (!ctx) return;
      const blend = 1 - Math.exp(-dt * 2.2);
      smoothX += (pointerX - smoothX) * blend;
      smoothY += (pointerY - smoothY) * blend;
      layer!.style.setProperty("--depth-x", `${smoothX}px`);
      layer!.style.setProperty("--depth-y", `${smoothY}px`);
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        const glow =
          0.47 +
          0.37 * Math.sin((seconds * Math.PI * 2) / star.period + star.phase);
        const x = star.x * width + smoothX * star.depth;
        const y = star.y * height + smoothY * star.depth;
        ctx.fillStyle = `rgba(222,236,255,${glow})`;
        ctx.beginPath();
        ctx.arc(x, y, star.radius, 0, Math.PI * 2);
        ctx.fill();
        if (star.radius > 1.55) {
          const halo = ctx.createRadialGradient(x, y, 0, x, y, star.radius * 4);
          halo.addColorStop(0, `rgba(188,221,255,${glow * 0.3})`);
          halo.addColorStop(1, "rgba(188,221,255,0)");
          ctx.fillStyle = halo;
          ctx.fillRect(
            x - star.radius * 4,
            y - star.radius * 4,
            star.radius * 8,
            star.radius * 8,
          );
          ctx.strokeStyle = `rgba(201,224,255,${glow * 0.45})`;
          ctx.beginPath();
          ctx.moveTo(x - 3, y);
          ctx.lineTo(x + 3, y);
          ctx.moveTo(x, y - 3);
          ctx.lineTo(x, y + 3);
          ctx.stroke();
        }
      }
      for (const [index, mote] of dust.entries()) {
        const x =
          mote.x * width +
          Math.sin(seconds * 0.16 * mote.speed + mote.phase) * width * 0.035 +
          smoothX * mote.depth;
        const y =
          mote.y * height +
          Math.cos(seconds * 0.12 * mote.speed + mote.phase) * height * 0.035 +
          smoothY * mote.depth;
        const behindCopy =
          x > width * 0.28 &&
          x < width * 0.73 &&
          y > height * 0.25 &&
          y < height * 0.73;
        const alpha =
          (0.24 + 0.15 * Math.sin(seconds * 0.45 + mote.phase)) *
          (behindCopy ? 0.28 : 1);
        const color = index % 4 === 0 ? "230,197,139" : "164,211,228";
        ctx.fillStyle = `rgba(${color},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, mote.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${color},${alpha * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - mote.speed * 4, y + 2);
        ctx.stroke();
      }
      // Portal energy remains an invitation, rather than the only moving region.
      const reach = Math.min(width * 0.17, 220);
      for (const [index, spark] of sparks.entries()) {
        const progress = (spark.phase + seconds * 0.045) % 1;
        const radius = 35 + reach * (1 - progress);
        const angle = spark.angle + seconds * 0.035;
        const x = centerX * width + Math.cos(angle) * radius * 0.7;
        const y = centerY * height + Math.sin(angle) * radius;
        const opacity = Math.sin(progress * Math.PI) * 0.8;
        const color = index % 3 === 0 ? "120,217,204" : "240,207,147";
        // Short, low-opacity trails make inward movement readable against the art.
        ctx.strokeStyle = `rgba(${color},${opacity * 0.45})`;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * 7, y + Math.sin(angle) * 10);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = `rgba(${color},${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, spark.depth * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    function tick(now: number) {
      if (!start) start = now;
      if (!document.hidden && now - lastFrame >= 32) {
        draw((now - start) / 1000, Math.min((now - lastFrame) / 1000, 0.1));
        lastFrame = now;
      }
      frame = requestAnimationFrame(tick);
    }
    function pointer(e: PointerEvent) {
      if (e.pointerType !== "mouse" || reduced) return;
      pointerX = (e.clientX / innerWidth - 0.5) * 12;
      pointerY = (e.clientY / innerHeight - 0.5) * 8;
    }
    const reset = () => {
      pointerX = 0;
      pointerY = 0;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(layer);
    resize();
    if (!reduced) {
      frame = requestAnimationFrame(tick);
      window.addEventListener("pointermove", pointer, { passive: true });
      window.addEventListener("blur", reset);
      document.addEventListener("pointerleave", reset);
    }
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("blur", reset);
      document.removeEventListener("pointerleave", reset);
      layer.style.removeProperty("--depth-x");
      layer.style.removeProperty("--depth-y");
      ctx.clearRect(0, 0, width, height);
    };
  }, [reduced, simple]);
  return (
    <div
      className={`hero-environment${simple ? " simple-scene" : ""}`}
      ref={root}
      aria-hidden="true"
    >
      <div className="hero-art">
        <div className="hero-haze" />
      </div>
      <div className="nebula-drift nebula-far" />
      <div className="nebula-drift nebula-near" />
      <div className="nebula-drift nebula-west" />
      <div className="nebula-drift nebula-middle" />
      <div className="nebula-drift nebula-floor" />
      <DriftingIsland className="structure-west" />
      <DriftingIsland className="structure-high" />
      <DriftingIsland className="structure-low" />
      <div className="floating-fragment fragment-far">
        <i />
      </div>
      <div className="floating-fragment fragment-near">
        <i />
      </div>
      <div className="landing-portal" ref={portal}>
        <div className="portal-halo" />
        <div className="portal-heart" />
        <div className="portal-orbit" />
      </div>
      <canvas className="living-stars" ref={canvas} />
    </div>
  );
}

function DriftingIsland({ className }: { className: string }) {
  return (
    <div className={`drifting-island ${className}`}>
      <svg viewBox="0 0 110 100" fill="none">
        <path d="M10 44 42 38 96 44 82 66 57 95 44 76 26 69Z" fill="#182b42" />
        <path d="M10 44 42 38 96 44 77 49 35 50Z" fill="#50657a" />
        <path
          d="m26 49 18 27 13 19-6-47m26 1 5 17-25 29 12-46"
          stroke="#304a60"
          strokeWidth="2"
        />
        <path
          d="M34 41V23h8v18m17 0V14h10v27m10 1V29h7v13"
          fill="#263e53"
          stroke="#6b7c8c"
          strokeWidth="1"
        />
        <path d="m30 23 8-8 8 8m9-9 9-12 9 12m2 15 7-7 8 7" fill="#687083" />
        <path d="M38 29v5m26-14v7m19 8v3" stroke="#e6c58b" strokeWidth="1.5" />
        <path d="M31 50v25m3-23v20" stroke="#78d9cc" strokeOpacity=".35" />
      </svg>
    </div>
  );
}
