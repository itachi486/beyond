import * as T from "three";
import type { World } from "../data/universe";
import type { Locale } from "../locales";

/** World-space lettering and destination-specific light paths; no HTML title panels. */
export function createWorldTitles(
  scene: T.Scene,
  worlds: World[],
  simple: boolean,
  invalidate: () => void,
) {
  const glowPixels = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4,
        r = Math.hypot((x - 7.5) / 7.5, (y - 7.5) / 7.5);
      glowPixels[i] = glowPixels[i + 1] = glowPixels[i + 2] = 255;
      glowPixels[i + 3] =
        r < 1 ? Math.round(Math.exp(-r * r * 6) * (1 - r) * 255) : 0;
    }
  const glowMap = new T.DataTexture(glowPixels, 16, 16);
  glowMap.needsUpdate = true;
  let locale: Locale = "en",
    active: string | null = null;
  const heights: Record<string, number> = {
    "what-if": 10,
    "human-mind": 16,
    unsolved: 25,
    "hidden-worlds": 16,
    "your-future": 20,
    "never-knew": 18,
  };
  const entries = worlds.map((world, index) => {
    const group = new T.Group();
    group.name = `world-title-${world.hubKey}`;
    const [x, , z] = world.hubPosition!;
    const height = heights[world.hubKey!] || 16;
    group.position.set(x, height, z + 1);
    scene.add(group);
    group.visible = false;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const uniforms = {
      lettering: { value: texture },
      reveal: { value: 0 },
      alpha: { value: 0 },
      ink: { value: new T.Color(world.color) },
    };
    const material = new T.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      vertexShader:
        "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `uniform sampler2D lettering;uniform float reveal;uniform float alpha;uniform vec3 ink;varying vec2 vUv;void main(){vec4 glyph=texture2D(lettering,vUv);float mask=1.-smoothstep(reveal-.09,reveal,vUv.x);float edge=exp(-pow((vUv.x-reveal+.025)*45.,2.));gl_FragColor=vec4(mix(ink,vec3(1.,.96,.82),.65)+edge*.25,glyph.a*mask*alpha);}`,
    });
    const label = new T.Mesh(new T.PlaneGeometry(18, 4.5), material);
    label.renderOrder = 10;
    group.add(label);
    const count = simple ? 18 : 36,
      geo = new T.BufferGeometry();
    geo.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(count * 3), 3),
    );
    const pointMat = new T.PointsMaterial({
      color: world.color,
      size: 0.1,
      map: glowMap,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    const particles = new T.Points(geo, pointMat);
    scene.add(particles);
    const lines = Array.from({ length: simple ? 2 : 3 }, () => {
      const g = new T.BufferGeometry();
      g.setAttribute(
        "position",
        new T.BufferAttribute(new Float32Array(40 * 3), 3),
      );
      const m = new T.LineBasicMaterial({
        color: world.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: T.AdditiveBlending,
      });
      const line = new T.Line(g, m);
      scene.add(line);
      return line;
    });
    function paint() {
      const c = canvas.getContext("2d");
      if (!c) return;
      c.clearRect(0, 0, 1024, 256);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "#fff8e4";
      c.shadowColor = world.color;
      c.shadowBlur = 12;
      const title = world.name[locale] || world.name.en;
      const parts = title.length > 21 ? title.split(/ (?=\S+ \S+$)/) : [title];
      c.font = `${parts.length > 1 ? 62 : 70}px Georgia,serif`;
      parts
        .slice(0, 2)
        .forEach((text, i) =>
          c.fillText(text, 512, parts.length > 1 ? 94 + i * 77 : 128, 970),
        );
      texture.needsUpdate = true;
      invalidate();
    }
    paint();
    return {
      world,
      index,
      group,
      label,
      texture,
      material,
      uniforms,
      particles,
      lines,
      progress: 0,
      paint,
    };
  });
  function curve(
    key: string,
    t: number,
    lane: number,
    origin: T.Vector3,
    top: T.Vector3,
  ) {
    const p = origin.clone().lerp(top, t),
      s = Math.sin(t * Math.PI),
      phase = lane * 2.1;
    switch (key) {
      case "what-if":
        p.x += s * (lane - 1) * 2.3;
        p.z += s;
        break;
      case "human-mind":
        p.x += Math.cos(t * 8 + phase) * s * 2.1;
        p.z += Math.sin(t * 8 + phase) * s * 1.5;
        break;
      case "unsolved":
        p.x += Math.sin(t * 4 + phase) * s * 0.8;
        p.z += Math.cos(t * 3 + phase) * s;
        break;
      case "hidden-worlds":
        p.x += Math.sin(t * 5 + phase) * s * 1.8;
        p.z += s * 2;
        break;
      case "your-future":
        p.x += s * (lane - 1) * 1.4;
        p.z += Math.sin(t * 3) * 0.8;
        break;
      default:
        p.x += Math.cos(t * 6 + phase) * s * 2.5;
        p.z += Math.sin(t * 6 + phase) * s * 2;
    }
    return p;
  }
  return {
    select(id: string | null) {
      if (active !== id) {
        active = id;
        invalidate();
      }
    },
    setLocale(next: Locale) {
      if (locale !== next) {
        locale = next;
        entries.forEach((e) => e.paint());
      }
    },
    busy(reduced: boolean) {
      return entries.some((e) =>
        reduced
          ? e.progress !== (e.world.id === active ? 1 : 0)
          : e.progress > 0 || e.world.id === active,
      );
    },
    update(seconds: number, dt: number, camera: T.Camera, reduced: boolean) {
      for (const e of entries) {
        const desired = e.world.id === active ? 1 : 0;
        e.progress = reduced
          ? desired
          : T.MathUtils.damp(e.progress, desired, desired ? 5 : 7, dt);
        if (Math.abs(e.progress - desired) < 0.004) e.progress = desired;
        e.group.visible = e.progress > 0;
        const originPosition = e.world.hubPosition!;
        const distance = Math.hypot(
          camera.position.x - originPosition[0],
          camera.position.z - originPosition[2],
        );
        const blend = T.MathUtils.smoothstep(distance, 18, 35);
        const height = heights[e.world.hubKey!] || 16;
        e.group.position.y = T.MathUtils.lerp(
          camera.position.y - distance * 0.05,
          height,
          blend,
        );
        e.group.position.z = originPosition[2] + 2;
        e.label.scale.setScalar(T.MathUtils.clamp(distance / 45, 0.24, 1));
        e.label.quaternion.copy(camera.quaternion);
        e.uniforms.alpha.value = e.progress;
        e.uniforms.reveal.value = e.progress * 1.15;
        const [x, , z] = e.world.hubPosition!;
        const origin = new T.Vector3(x, 4, z),
          top = e.group.position.clone();
        const positions = e.particles.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const t = (seconds * 0.13 + i / positions.count) % 1,
            p = curve(e.world.hubKey!, t, i % 3, origin, top);
          positions.setXYZ(i, p.x, p.y, p.z);
        }
        positions.needsUpdate = true;
        e.particles.visible = !reduced && e.progress > 0;
        (e.particles.material as T.PointsMaterial).opacity = e.progress * 0.65;
        e.lines.forEach((line, lane) => {
          const a = line.geometry.attributes.position;
          for (let i = 0; i < a.count; i++) {
            const t = (i / (a.count - 1)) * Math.min(1, e.progress * 1.4),
              p = curve(e.world.hubKey!, t, lane, origin, top);
            a.setXYZ(i, p.x, p.y, p.z);
          }
          a.needsUpdate = true;
          line.visible = !reduced && e.progress > 0;
          (line.material as T.LineBasicMaterial).opacity = e.progress * 0.24;
        });
      }
    },
    dispose() {
      entries.forEach((e) => e.texture.dispose());
      glowMap.dispose();
    },
  };
}
