import * as T from "three";
import { discoveries, worlds, type WorldId } from "../data/universe";
export interface EngineOptions {
  world: WorldId;
  simple: boolean;
  reduced: boolean;
  onSelect: (id: string) => void;
  onPortal: (id: WorldId) => void;
  onFailure: () => void;
  onReady: () => void;
  onPosition: (x: number, z: number) => void;
}
export function createUniverse(host: HTMLDivElement, options: EngineOptions) {
  const scene = new T.Scene();
  const world = worlds.find((w) => w.id === options.world)!;
  const colors = {
    archive: 0x10182e,
    elsewhere: 0x21172f,
    unsolved: 0x0b1431,
    natural: 0x08282b,
  };
  scene.background = new T.Color(colors[options.world]);
  scene.fog = new T.FogExp2(colors[options.world], 0.009);
  const renderer = new T.WebGLRenderer({
    antialias: !options.simple,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, options.simple ? 1 : 1.6));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");
  const camera = new T.PerspectiveCamera(
    62,
    host.clientWidth / host.clientHeight,
    0.1,
    650,
  );
  camera.position.set(0, 5, 19);
  camera.rotation.order = "YXZ";
  let yaw = 0,
    pitch = -0.08;
  camera.rotation.x = pitch;
  scene.add(new T.HemisphereLight(0xb2d5ff, 0x20202e, 2.5));
  const sun = new T.DirectionalLight(0xffd3a0, 3);
  sun.position.set(20, 25, 10);
  scene.add(sun);
  const rim = new T.PointLight(world.color, 100, 100);
  rim.position.set(0, 10, -15);
  scene.add(rim);
  // Procedural sky: no remote texture, no camera rotation, and no animated shader noise.
  const sky = new T.Mesh(
    new T.SphereGeometry(480, 24, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: { accent: { value: new T.Color(world.color) } },
      vertexShader: `varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 direction;uniform vec3 accent;float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}void main(){vec3 d=normalize(direction);float f=n(d*4.)*.55+n(d*9.)*.28+n(d*21.)*.12;float band=exp(-pow((d.y-d.x*.25-.18)*4.,2.));vec3 col=mix(vec3(.022,.036,.085),vec3(.13,.16,.29),f);col+=mix(vec3(.12,.07,.24),accent*.16)*pow(f*band,1.6);col+=accent*.075*pow(max(0.,1.-abs(d.y+.14)),16.);gl_FragColor=vec4(col,1.);}`,
    }),
  );
  scene.add(sky);
  const mistCanvas = document.createElement("canvas");
  mistCanvas.width = 128;
  mistCanvas.height = 128;
  const ctx = mistCanvas.getContext("2d");
  let mistTexture: T.CanvasTexture | undefined;
  if (ctx) {
    const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(155,179,220,.5)");
    gr.addColorStop(0.5, "rgba(103,129,178,.22)");
    gr.addColorStop(1, "rgba(69,93,142,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 128, 128);
    mistTexture = new T.CanvasTexture(mistCanvas);
    for (let i = 0; i < (options.simple ? 6 : 14); i++) {
      const cloud = new T.Mesh(
        new T.PlaneGeometry(85, 45),
        new T.MeshBasicMaterial({
          map: mistTexture,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          side: T.DoubleSide,
        }),
      );
      cloud.position.set(
        Math.sin(i * 1.7) * 80,
        -16 - (i % 3) * 2,
        -20 - i * 9,
      );
      cloud.rotation.x = -Math.PI * 0.35;
      scene.add(cloud);
    }
  }
  const objects: T.Object3D[] = [];
  const floats: T.Group[] = [];
  const glows: T.Mesh[] = [];
  function mesh(
    g: T.BufferGeometry,
    c: T.ColorRepresentation,
    x = 0,
    y = 0,
    z = 0,
    metal = 0,
  ) {
    const m = new T.Mesh(
      g,
      new T.MeshStandardMaterial({
        color: c,
        roughness: 0.65,
        metalness: metal,
      }),
    );
    m.position.set(x, y, z);
    return m;
  }
  function island(
    x: number,
    y: number,
    z: number,
    r: number,
    style: WorldId,
    seed: number,
  ) {
    const g = new T.Group();
    g.position.set(x, y, z);
    const rockGeometry = new T.ConeGeometry(r, r * 2.8, 9, 3);
    const rp = rockGeometry.attributes.position;
    for (let v = 0; v < rp.count; v++) {
      const yv = rp.getY(v);
      const offset = Math.sin(v * 7.3 + seed) * r * 0.12;
      rp.setX(v, rp.getX(v) + offset);
      rp.setZ(v, rp.getZ(v) + Math.cos(v * 2.8) * r * 0.1);
      rp.setY(v, yv + Math.sin(v * 4.2) * r * 0.08);
    }
    rockGeometry.computeVertexNormals();
    const rock = mesh(
      rockGeometry,
      style === "elsewhere" ? 0x5f526d : 0x344554,
    );
    rock.rotation.z = Math.PI;
    rock.position.y = -r * 1.4;
    g.add(rock);
    const top = mesh(
      new T.CylinderGeometry(r, r, 0.45, 9),
      style === "natural" ? 0x36786b : 0x72777f,
      0,
      0,
      0,
    );
    g.add(top);
    if (style === "archive") {
      for (let i = 0; i < 5; i++) {
        const pillar = mesh(
          new T.BoxGeometry(0.55, 2.8, 0.6),
          0xb6b1a4,
          (i - 2) * 0.85,
          1.5,
          -0.7,
        );
        g.add(pillar);
      }
      g.add(mesh(new T.BoxGeometry(4.8, 0.4, 2), 0xd1c1a0, 0, 3, -0.5));
      const roof = mesh(
        new T.ConeGeometry(3.2, 1.3, 4),
        0x6c7491,
        0,
        3.8,
        -0.5,
      );
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
    }
    if (style === "elsewhere") {
      for (let i = 0; i < 6; i++) {
        const tower = mesh(
          new T.ConeGeometry(0.5 + (i % 2) * 0.2, 2 + (i % 3), 6),
          i % 2 ? 0x8c7195 : 0xbba0a1,
          Math.sin(i * 2) * r * 0.6,
          1,
          Math.cos(i * 2) * r * 0.5,
        );
        tower.rotation.z = 0.1 * Math.sin(i);
        g.add(tower);
      }
    }
    if (style === "unsolved") {
      for (let i = 0; i < 7; i++) {
        const shard = mesh(
          new T.OctahedronGeometry(0.8),
          0x8097ba,
          Math.sin(i) * r * 0.65,
          1.4 + (i % 3),
          Math.cos(i) * r * 0.6,
          0.5,
        );
        shard.rotation.set(i, 0.3 * i, 0.4);
        g.add(shard);
      }
    }
    if (style === "natural") {
      for (let i = 0; i < 7; i++) {
        const tx = Math.sin(i * 2.3) * r * 0.7,
          tz = Math.cos(i * 2.3) * r * 0.7;
        g.add(
          mesh(new T.CylinderGeometry(0.12, 0.23, 2, 5), 0x665449, tx, 1, tz),
        );
        g.add(
          mesh(
            new T.IcosahedronGeometry(0.95, 0),
            i % 2 ? 0x3e9b81 : 0x426e76,
            tx,
            2.2,
            tz,
          ),
        );
      }
      const water = mesh(
        new T.CylinderGeometry(r * 0.45, r * 0.4, 0.08, 20),
        0x74cad5,
        0,
        0.27,
        0.1,
        0.5,
      );
      g.add(water);
    }
    // Thin waterfalls and glimmering trails connect built and natural landscapes.
    for (let i = 0; i < 2; i++) {
      const falls = new T.Mesh(
        new T.CylinderGeometry(0.08, 0.2, r * 4, 5),
        new T.MeshBasicMaterial({
          color: 0x82d9ec,
          transparent: true,
          opacity: 0.35,
        }),
      );
      falls.position.set(r * 0.75, -r * 2, (i - 0.5) * r * 0.7);
      g.add(falls);
    }
    g.userData.baseY = y;
    g.userData.phase = seed;
    scene.add(g);
    floats.push(g);
    return g;
  }
  // Arrival island and traveler-scale architecture, plus distant layered silhouettes.
  island(0, -4, 17, 6, options.world, 0);
  for (let i = 0; i < 14; i++) {
    const a = i * 2.399;
    island(
      Math.cos(a) * (28 + i * 6),
      -7 + (i % 5) * 3,
      -35 - i * 9,
      2 + (i % 4),
      options.world,
      i,
    );
  }
  const current = discoveries.filter((d) => d.worldId === options.world);
  for (const [i, d] of current.entries()) {
    const [x, y, z] = d.position;
    const g = island(x, y, z, 4, options.world, i);
    const ring = new T.Mesh(
      new T.TorusGeometry(1.55, 0.09, 8, 56),
      new T.MeshBasicMaterial({ color: world.color }),
    );
    ring.position.set(0, 2.1, 1.3);
    g.add(ring);
    const interior = new T.Mesh(
      new T.CircleGeometry(1.42, 40),
      new T.MeshBasicMaterial({
        color: world.color,
        transparent: true,
        opacity: 0.18,
        side: T.DoubleSide,
      }),
    );
    interior.position.copy(ring.position);
    g.add(interior);
    for (const ob of [ring, interior]) {
      ob.userData.discovery = d.id;
      objects.push(ob);
    }
    glows.push(interior);
  }
  const portals = worlds.filter((w) => w.id !== options.world);
  portals.forEach((w, i) => {
    const x = (i - 1) * 17,
      z = -37 - Math.abs(i - 1) * 4;
    const g = island(x, -1, z, 2.8, w.id, i + 4);
    const arch = new T.Mesh(
      new T.TorusGeometry(2, 0.16, 8, 64),
      new T.MeshStandardMaterial({
        color: 0xe6c58b,
        emissive: w.color,
        emissiveIntensity: 0.65,
        metalness: 0.7,
        roughness: 0.3,
      }),
    );
    arch.position.set(0, 2, 1);
    g.add(arch);
    const door = new T.Mesh(
      new T.CircleGeometry(1.85, 48),
      new T.MeshBasicMaterial({
        color: w.color,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.65,
      }),
    );
    door.position.copy(arch.position);
    g.add(door);
    [arch, door].forEach((o) => {
      o.userData.portal = w.id;
      objects.push(o);
    });
    glows.push(door);
  });
  // Every line is an explicit data relation between discoveries in this world.
  for (const d of current)
    for (const id of d.relatedIds) {
      const dest = current.find((v) => v.id === id);
      if (dest && d.id < dest.id) {
        const a = new T.Vector3(...d.position).add(new T.Vector3(0, 2, 1)),
          b = new T.Vector3(...dest.position).add(new T.Vector3(0, 2, 1));
        const curve = new T.QuadraticBezierCurve3(
          a,
          a
            .clone()
            .lerp(b, 0.5)
            .add(new T.Vector3(0, 4, 0)),
          b,
        );
        scene.add(
          new T.Line(
            new T.BufferGeometry().setFromPoints(curve.getPoints(32)),
            new T.LineBasicMaterial({
              color: 0x78d9cc,
              transparent: true,
              opacity: 0.6,
            }),
          ),
        );
      }
    }
  let seed = 72;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const starCount = options.simple ? 450 : 1400;
  const stars = new Float32Array(starCount * 3);
  for (let i = 0; i < stars.length; i += 3) {
    stars[i] = (rand() - 0.5) * 550;
    stars[i + 1] = rand() * 170 + 12;
    stars[i + 2] = (rand() - 0.65) * 550;
  }
  const starGeo = new T.BufferGeometry();
  starGeo.setAttribute("position", new T.BufferAttribute(stars, 3));
  scene.add(
    new T.Points(
      starGeo,
      new T.PointsMaterial({
        color: 0xc6d9ff,
        size: 0.36,
        sizeAttenuation: true,
      }),
    ),
  );
  const planet = mesh(
    new T.SphereGeometry(19, 24, 20),
    options.world === "natural" ? 0x2e6976 : 0x374d82,
    -85,
    52,
    -180,
    0.25,
  );
  scene.add(planet);
  const orbit = new T.Mesh(
    new T.TorusGeometry(29, 0.12, 5, 120),
    new T.MeshBasicMaterial({
      color: 0x7a91c7,
      transparent: true,
      opacity: 0.5,
    }),
  );
  orbit.position.copy(planet.position);
  orbit.rotation.x = 1.2;
  orbit.rotation.y = 0.3;
  scene.add(orbit);
  const keys = new Set<string>();
  let down = false,
    moved = false,
    startX = 0,
    startY = 0,
    lastX = 0,
    lastY = 0,
    frame = 0,
    last = performance.now(),
    lastPos = 0;
  const ray = new T.Raycaster();
  const p = new T.Vector2();
  function pointerDown(e: PointerEvent) {
    down = true;
    moved = false;
    lastX = startX = e.clientX;
    lastY = startY = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: PointerEvent) {
    if (!down) {
      const r = renderer.domElement.getBoundingClientRect();
      p.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(p, camera);
      const hit = ray.intersectObjects(objects)[0];
      renderer.domElement.style.cursor = hit ? "pointer" : "grab";
      return;
    }
    if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 5)
      moved = true;
    yaw -= (e.clientX - lastX) * 0.003;
    pitch = T.MathUtils.clamp(pitch - (e.clientY - lastY) * 0.003, -1.1, 1.1);
    camera.rotation.set(pitch, yaw, 0);
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function pointerUp(e: PointerEvent) {
    if (!down) return;
    down = false;
    if (moved) return;
    const r = renderer.domElement.getBoundingClientRect();
    p.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(p, camera);
    const hit = ray.intersectObjects(objects)[0];
    if (hit?.object.userData.discovery)
      options.onSelect(hit.object.userData.discovery);
    if (hit?.object.userData.portal)
      options.onPortal(hit.object.userData.portal);
  }
  function keydown(e: KeyboardEvent) {
    if (
      (e.target as HTMLElement)?.closest(
        "input,select,textarea,button,dialog,[data-overlay]",
      )
    )
      return;
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.key)
    ) {
      e.preventDefault();
      keys.add(e.key);
    }
  }
  const keyup = (e: KeyboardEvent) => keys.delete(e.key),
    blur = () => {
      keys.clear();
      down = false;
    };
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointermove", pointerMove);
  renderer.domElement.addEventListener("pointerup", pointerUp);
  renderer.domElement.addEventListener("pointercancel", blur);
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", blur);
  const resize = new ResizeObserver(() => {
    if (host.clientWidth && host.clientHeight) {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    }
  });
  resize.observe(host);
  const lost = (e: Event) => {
    e.preventDefault();
    options.onFailure();
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  let paused = false;
  function animate(now: number) {
    frame = requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (document.hidden) return;
    if (!paused) {
      let dx =
          Number(keys.has("d") || keys.has("ArrowRight")) -
          Number(keys.has("a") || keys.has("ArrowLeft")),
        dz =
          Number(keys.has("s") || keys.has("ArrowDown")) -
          Number(keys.has("w") || keys.has("ArrowUp"));
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      camera.position.x = T.MathUtils.clamp(
        camera.position.x + (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * dt * 9,
        -100,
        100,
      );
      camera.position.z = T.MathUtils.clamp(
        camera.position.z + (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * dt * 9,
        -110,
        55,
      );
    }
    if (!options.reduced) {
      floats.forEach(
        (g) =>
          (g.position.y =
            g.userData.baseY +
            Math.sin(now * 0.0004 + g.userData.phase) * 0.22),
      );
      glows.forEach(
        (g, i) =>
          ((g.material as T.MeshBasicMaterial).opacity =
            0.3 + Math.sin(now * 0.0008 + i) * 0.09),
      );
    }
    renderer.render(scene, camera);
    if (now - lastPos > 500) {
      lastPos = now;
      options.onPosition(camera.position.x, camera.position.z);
    }
  }
  frame = requestAnimationFrame(animate);
  options.onReady();
  return {
    move: (key: string, pressed: boolean) =>
      pressed ? keys.add(key) : keys.delete(key),
    pause: (v: boolean) => {
      paused = v;
      keys.clear();
    },
    reset: () => {
      camera.position.set(0, 5, 19);
      yaw = 0;
      pitch = -0.08;
      camera.rotation.set(pitch, yaw, 0);
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", blur);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      scene.traverse((o) => {
        const m = o as T.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((v) =>
            v.dispose(),
          );
        }
      });
      mistTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
