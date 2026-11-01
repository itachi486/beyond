import type { World } from "../data/universe";
import type { Locale } from "../locales";
import { selectionRegions } from "./selectionRegions";
type Mode = {
  active: string | null;
  clicked: string | null;
  locale: Locale;
  reduced: boolean;
  simple: boolean;
};
export function startSelectionEffects(
  canvas: HTMLCanvasElement,
  worlds: World[],
  mode: () => Mode,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let width = 1,
    height = 1,
    frame = 0,
    last = 0,
    oldKey = "",
    oldActive: string | null = null,
    clock = 0;
  const random = (n: number) => {
    const a = Math.sin(n * 127.1 + 71.7) * 43758.5453;
    return a - Math.floor(a);
  };
  const entries = selectionRegions.map((region, index) => ({
    region,
    world: worlds.find((w) => w.hubKey === region.key),
    index,
    amount: 0,
    started: 0,
    locale: "" as string,
    glyph: document.createElement("canvas"),
    targets: [] as [number, number][],
  }));
  function resize() {
    const r = canvas.getBoundingClientRect();
    width = r.width;
    height = r.height;
    const dpr = Math.min(devicePixelRatio, mode().simple ? 1 : 1.25);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    oldKey = "";
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  function paintGlyph(e: (typeof entries)[number], locale: Locale) {
    e.locale = locale;
    e.glyph.width = 512;
    e.glyph.height = 128;
    const c = e.glyph.getContext("2d")!;
    const title = e.world?.name[locale] || e.world?.name.en || "";
    let size = 38;
    c.font = `${size}px Georgia,serif`;
    if (c.measureText(title).width > 492)
      size = Math.floor((size * 492) / c.measureText(title).width);
    c.font = `${size}px Georgia,serif`;
    c.fillStyle = "#fff8e8";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(title, 256, 64);
    const pixels = c.getImageData(0, 0, 512, 128).data,
      all: [number, number][] = [];
    for (let y = 28; y < 100; y += 3)
      for (let x = 8; x < 504; x += 3)
        if (pixels[(y * 512 + x) * 4 + 3] > 120)
          all.push([x / 512 - 0.5, y / 128 - 0.5]);
    const count = Math.min(mode().simple ? 140 : 300, all.length);
    e.targets = Array.from(
      { length: count },
      (_, i) => all[Math.floor((i * all.length) / count)],
    );
  }
  function glow(x: number, y: number, r: number, color: string, alpha: number) {
    ctx!.globalAlpha = alpha;
    const g = ctx!.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(0.18, color + "99");
    g.addColorStop(1, color + "00");
    ctx!.fillStyle = g;
    ctx!.fillRect(x - r, y - r, r * 2, r * 2);
    ctx!.globalAlpha = 1;
  }
  function trail(
    key: string,
    t: number,
    lane: number,
    cx: number,
    cy: number,
    tx: number,
    ty: number,
  ) {
    const s = Math.sin(t * Math.PI),
      x = cx + (tx - cx) * t,
      y = cy + (ty - cy) * t;
    switch (key) {
      case "what-if":
        return [x + s * (lane - 1) * width * 0.045, y + s * height * 0.025];
      case "human-mind":
        return [
          x + Math.cos(t * 10 + lane * 2) * s * width * 0.035,
          y + Math.sin(t * 10 + lane * 2) * s * height * 0.045,
        ];
      case "unsolved":
        return [
          x + Math.sin(t * 5 + lane) * s * width * 0.014,
          y - s * height * 0.04,
        ];
      case "hidden-worlds":
        return [
          x + Math.sin(t * 9 + lane * 2) * s * width * 0.03,
          y + Math.cos(t * 7 + lane) * s * height * 0.025,
        ];
      case "your-future":
        return [
          x + s * (lane - 1) * width * 0.025,
          y - Math.abs(Math.sin(t * 7)) * s * height * 0.018,
        ];
      default:
        return [
          x + Math.cos(t * 7 + lane) * s * width * 0.04,
          y + Math.sin(t * 7 + lane) * s * height * 0.04,
        ];
    }
  }
  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    if (document.hidden) return;
    const m = mode(),
      key = `${m.active}|${m.clicked}|${m.locale}|${m.reduced}|${width}|${height}`;
    if (m.reduced && key === oldKey) return;
    if (!m.reduced && now - last < 1000 / 30) return;
    const dt = Math.min((now - last) / 1000, 0.06);
    last = now;
    clock = now / 1000;
    if (m.active !== oldActive) {
      entries.forEach((e) => {
        if (e.world?.id === m.active) e.started = clock;
      });
      oldActive = m.active;
    }
    oldKey = key;
    ctx!.clearRect(0, 0, width, height);
    ctx!.globalCompositeOperation = "screen";
    if (!m.reduced) {
      for (let i = 0; i < (m.simple ? 38 : 90); i++) {
        const x = random(i) * width,
          y = random(i + 200) * height * 0.7,
          a =
            0.1 +
            (0.5 + 0.5 * Math.sin(clock * (0.4 + random(i + 5)) + i)) * 0.45;
        ctx!.globalAlpha = a;
        ctx!.fillStyle = i % 3 ? "#b8d8ff" : "#f4d995";
        ctx!.beginPath();
        ctx!.arc(
          x + Math.sin(clock * 0.04 + i) * 3,
          y,
          0.6 + random(i + 4) * 0.8,
          0,
          Math.PI * 2,
        );
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      for (const e of entries)
        glow(
          e.region.center[0] * width,
          e.region.center[1] * height,
          width * 0.028,
          e.region.color,
          0.035 + (0.5 + 0.5 * Math.sin(clock * 0.55 + e.index)) * 0.035,
        );
      // Slow, transparent atmospheric overlays; original artwork remains a single untouched image.
      glow(
        width * (0.45 + Math.sin(clock * 0.025) * 0.07),
        height * 0.57,
        width * 0.2,
        "#9dbfe6",
        0.018,
      );
    }
    for (const e of entries) {
      if (!e.world) continue;
      const active = e.world.id === m.active,
        desired = active ? 1 : 0;
      e.amount = m.reduced
        ? desired
        : e.amount +
          (desired - e.amount) * (1 - Math.exp(-dt * (active ? 7 : 4.5)));
      if (e.amount < 0.005) {
        e.amount = 0;
        continue;
      }
      if (e.locale !== m.locale) paintGlyph(e, m.locale);
      const r = e.region,
        cx = r.center[0] * width,
        cy = r.center[1] * height;
      const tw = Math.min(width * 0.25, 440),
        textWidth = Math.max(Math.min(280, width - 24), tw),
        textHeight = textWidth / 4;
      const tx = Math.max(
          textWidth / 2 + 8,
          Math.min(width - textWidth / 2 - 8, r.title[0] * width),
        ),
        ty = r.title[1] * height;
      const age = Math.max(0, clock - e.started),
        formed = m.reduced ? 1 : Math.min(1, age / 1.05),
        ease = formed * formed * (3 - 2 * formed),
        clicked = e.world.id === m.clicked;
      const power = e.amount * (clicked ? 1.6 : 1);
      ctx!.save();
      ctx!.beginPath();
      r.polygon.forEach(([x, y], i) =>
        i
          ? ctx!.lineTo(x * width, y * height)
          : ctx!.moveTo(x * width, y * height),
      );
      ctx!.closePath();
      ctx!.clip();
      glow(cx, cy, width * 0.17, r.color, power * (m.reduced ? 0.12 : 0.2));
      ctx!.restore();
      glow(cx, cy, width * 0.065, r.color, power * (clicked ? 0.55 : 0.28));
      if (!m.reduced) {
        for (let ring = 0; ring < 3; ring++) {
          const phase = (age * 0.42 + ring / 3) % 1;
          ctx!.globalAlpha = power * (1 - phase) * 0.42;
          ctx!.strokeStyle = ring % 2 ? r.accent || r.color : r.color;
          ctx!.lineWidth = 1.2;
          ctx!.beginPath();
          ctx!.ellipse(
            cx,
            cy,
            width * (0.018 + phase * 0.07),
            height * (0.018 + phase * 0.055),
            e.index === 1 ? -0.25 : 0,
            0,
            Math.PI * 2,
          );
          ctx!.stroke();
        }
        ctx!.globalAlpha = 1;
        for (let lane = 0; lane < 3; lane++) {
          ctx!.beginPath();
          for (let j = 0; j <= 45; j++) {
            const t = (j / 45) * Math.min(1, formed * 1.4),
              p = trail(r.key, t, lane, cx, cy, tx, ty);
            j ? ctx!.lineTo(p[0], p[1]) : ctx!.moveTo(p[0], p[1]);
          }
          ctx!.strokeStyle = lane === 1 ? r.accent || r.color : r.color;
          ctx!.lineWidth = lane === 1 ? 1.8 : 0.7;
          ctx!.shadowColor = r.color;
          ctx!.shadowBlur = 12;
          ctx!.globalAlpha = power * 0.42;
          ctx!.stroke();
        }
        ctx!.shadowBlur = 0;
        ctx!.globalAlpha = 1;
        // Burst particles become letter samples, rather than merely accompanying a text fade.
        e.targets.forEach(([gx, gy], i) => {
          const targetX = tx + gx * textWidth,
            targetY = ty + gy * textHeight,
            delay = random(i + e.index) * 0.18,
            t = Math.max(0, Math.min(1, (ease - delay) / (1 - delay))),
            p = trail(r.key, t, i % 3, cx, cy, targetX, targetY);
          const spiral = (1 - t) * height * 0.045;
          const dispersion = active ? 0 : (1 - e.amount) * height * 0.15;
          const x =
              p[0] +
              Math.cos(i * 2.4 + age * 5) * spiral +
              Math.cos(i * 2.4) * dispersion,
            y =
              p[1] +
              Math.sin(i * 2.4 + age * 4) * spiral +
              Math.sin(i * 2.4) * dispersion;
          ctx!.globalAlpha =
            power *
            (0.35 + 0.6 * random(i + 60)) *
            (active ? 1 : Math.max(0.15, e.amount));
          ctx!.fillStyle = i % 3 === 0 ? r.accent || r.color : r.color;
          ctx!.beginPath();
          ctx!.arc(
            x,
            y,
            t > 0.99 ? 0.65 : 0.8 + random(i) * 1.3,
            0,
            Math.PI * 2,
          );
          ctx!.fill();
        });
        ctx!.globalAlpha = 1;
        for (let i = 0; i < (m.simple ? 24 : 52); i++) {
          const angle = random(i + 2) * Math.PI * 2,
            phase = (age * 0.35 + random(i + 5)) % 1,
            radius = (clicked ? 1 - phase : phase) * width * 0.08;
          const x = cx + Math.cos(angle) * radius,
            y = cy + Math.sin(angle) * radius * 0.6;
          ctx!.globalAlpha = power * (1 - phase) * 0.7;
          ctx!.fillStyle = i % 3 === 0 ? r.accent || r.color : r.color;
          ctx!.fillRect(x, y, 1.4, 1.4);
        }
        ctx!.globalAlpha = 1;
      }
      ctx!.save();
      ctx!.beginPath();
      ctx!.rect(
        tx - textWidth / 2,
        ty - textHeight / 2,
        textWidth * (m.reduced ? 1 : Math.max(0, (formed - 0.3) / 0.7)),
        textHeight,
      );
      ctx!.clip();
      ctx!.globalAlpha =
        e.amount *
        (m.reduced ? 1 : Math.min(1, Math.max(0, (formed - 0.55) / 0.45)));
      ctx!.shadowColor = r.color;
      ctx!.shadowBlur = 20;
      ctx!.drawImage(
        e.glyph,
        tx - textWidth / 2,
        ty - textHeight / 2,
        textWidth,
        textHeight,
      );
      ctx!.restore();
    }
    ctx!.globalAlpha = 1;
    ctx!.shadowBlur = 0;
    ctx!.globalCompositeOperation = "source-over";
  }
  frame = requestAnimationFrame(tick);
  return {
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      ctx.clearRect(0, 0, width, height);
    },
  };
}
