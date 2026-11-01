import * as T from "three";
import { createHiddenWorlds } from "./hiddenWorlds";
import { createWorldTitles } from "./worldTitles";
import type { Locale } from "../locales";
import { createHubEnvironment } from "./hubEnvironment";
import type { World, Discovery } from "../data/universe";
interface HubOptions {
  worlds: World[];
  discoveries: Discovery[];
  onDiscovery: (id: string) => void;
  simple: boolean;
  reduced: boolean;
  onHover: (id: string | null) => void;
  onArrive: (id: string | null) => void;
  onPosition: (x: number, z: number) => void;
  onFail: () => void;
  onReady: () => void;
  onAnchors: (anchors: { id: string; x: number; y: number }[]) => void;
}
export function createHub(host: HTMLDivElement, o: HubOptions) {
  let dirty = true;
  const invalidate = () => {
    dirty = true;
  };
  const gardenEffects: ReturnType<typeof createHiddenWorlds>[] = [];
  const scene = new T.Scene();
  scene.background = new T.Color("#0b1429");
  scene.fog = new T.FogExp2("#1b2b44", 0.0065);
  const r = new T.WebGLRenderer({
    antialias: !o.simple,
    powerPreference: "low-power",
  });
  r.setPixelRatio(Math.min(devicePixelRatio, o.simple ? 1 : 1.5));
  r.setSize(host.clientWidth, host.clientHeight);
  r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.22;
  host.append(r.domElement);
  r.domElement.setAttribute("aria-hidden", "true");
  const camera = new T.PerspectiveCamera(
    68,
    host.clientWidth / host.clientHeight,
    0.1,
    350,
  );
  const initialZ =
    host.clientWidth / host.clientHeight < 0.7
      ? 64
      : host.clientWidth / host.clientHeight < 1
        ? 45
        : 32;
  const eye = 10;
  camera.position.set(0, eye, initialZ);
  camera.rotation.order = "YXZ";
  let yaw = 0,
    pitch = -0.2;
  camera.rotation.x = pitch;
  scene.add(new T.HemisphereLight("#91b4e6", "#17212e", 1.5));
  const sun = new T.DirectionalLight("#f4d8a3", 3.5);
  sun.position.set(-35, 24, 12);
  scene.add(sun);
  const environment = createHubEnvironment(scene, o.simple, invalidate);
  const stone = environment.stone;
  const dark = new T.MeshStandardMaterial({ color: "#26384a", roughness: 0.8 });
  const gold = new T.MeshStandardMaterial({
    color: "#bd9d64",
    metalness: 0.65,
    roughness: 0.3,
  });
  function mesh(
    geo: T.BufferGeometry,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = scene,
  ) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  const glow = (color: string, opacity = 1) =>
    new T.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      side: T.DoubleSide,
      depthWrite: opacity === 1,
    });
  function arch(g: T.Group, x: number, z: number, color: string, scale = 1) {
    mesh(new T.BoxGeometry(0.35, 3, 0.45), gold, x - 1.2 * scale, 1.5, z, g);
    mesh(new T.BoxGeometry(0.35, 3, 0.45), gold, x + 1.2 * scale, 1.5, z, g);
    const a = mesh(
      new T.TorusGeometry(1.2 * scale, 0.16, 6, 32, Math.PI),
      gold,
      x,
      3,
      z,
      g,
    );
    a.rotation.z = 0;
    mesh(
      new T.PlaneGeometry(2.1 * scale, 3.5),
      glow(color, 0.2),
      x,
      1.9,
      z - 0.05,
      g,
    );
  }
  const island = environment.island;
  island(0, 11, 13);
  environment.compass();
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    mesh(
      new T.CylinderGeometry(0.12, 0.18, 1, 6),
      gold,
      Math.cos(a) * 11,
      0.5,
      11 + Math.sin(a) * 11,
    );
    const line = new T.Line(
      new T.BufferGeometry().setFromPoints([
        new T.Vector3(0, 0.02, 11),
        new T.Vector3(Math.cos(a) * 11, 0.02, 11 + Math.sin(a) * 11),
      ]),
      new T.LineBasicMaterial({
        color: "#8b826b",
        transparent: true,
        opacity: 0.6,
      }),
    );
    scene.add(line);
  }
  for (const radius of [3, 6, 9]) {
    const ring = mesh(
      new T.TorusGeometry(radius, 0.025, 3, 64),
      gold,
      0,
      0.02,
      11,
    );
    ring.rotation.x = Math.PI / 2;
  }
  const targets: T.Object3D[] = [];
  const paths = new Map<string, T.Vector3[]>();
  const approachEnds = new Map<string, number>();
  const locations = new Map<string, T.Vector3>();
  const animated: T.Object3D[] = [];
  const worldLights = new Map<string, T.PointLight>();
  const routeTiles: { position: T.Vector3; length: number; angle: number }[] =
    [];
  o.worlds.forEach((w, index) => {
    const [x, , z] = w.hubPosition || [(index - 2.5) * 10, 0, -20];
    locations.set(w.id, new T.Vector3(x, eye, z + 4.5));
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.userData.destination = w.id;
    scene.add(g);
    if (w.hubKey !== "hidden-worlds") island(0, 0, 6, g);
    const light = new T.PointLight(w.color, 25, 18);
    light.position.set(x, 4, z);
    scene.add(light);
    worldLights.set(w.id, light);
    const architecture = new T.Group();
    g.add(architecture);
    const luminous = glow(w.color);
    switch (w.hubKey) {
      case "what-if":
        for (let j = 0; j < 3; j++) {
          arch(architecture, (j - 1) * 3, -Math.abs(j - 1) * 2, w.color, 0.8);
          const curve = new T.CatmullRomCurve3([
            new T.Vector3(0, 0.15, 4),
            new T.Vector3((j - 1) * 2, 0.15, 1),
            new T.Vector3((j - 1) * 3, 0.15, -Math.abs(j - 1) * 2),
          ]);
          mesh(
            new T.TubeGeometry(curve, 20, 0.045, 4),
            luminous,
            0,
            0,
            0,
            architecture,
          );
        }
        break;
      case "human-mind": {
        mesh(
          new T.CylinderGeometry(4, 4, 0.8, 24),
          gold,
          0,
          0.4,
          0,
          architecture,
        );
        const sphere = mesh(
          new T.SphereGeometry(3.6, 24, 18),
          new T.MeshPhysicalMaterial({
            color: w.color,
            transparent: true,
            opacity: 0.22,
            metalness: 0.3,
            roughness: 0.08,
            side: T.DoubleSide,
            depthWrite: false,
          }),
          0,
          4.6,
          0,
          architecture,
        );
        animated.push(sphere);
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          mesh(
            new T.ConeGeometry(0.25, 3 + (i % 3), 5),
            luminous,
            Math.cos(a) * 2,
            2.5,
            Math.sin(a) * 2,
            architecture,
          );
        }
        for (let i = 0; i < 3; i++) {
          const orb = mesh(
            new T.TorusGeometry(4, 0.025, 3, 64),
            luminous,
            0,
            4.6,
            0,
            architecture,
          );
          orb.rotation.set(i * 0.7, i * 0.4, 0);
          animated.push(orb);
        }
        break;
      }
      case "unsolved": {
        mesh(
          new T.CylinderGeometry(1.5, 2, 11, 8),
          dark,
          0,
          5.5,
          0,
          architecture,
        );
        mesh(new T.ConeGeometry(1.8, 4, 8), stone, 0, 13, 0, architecture);
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          mesh(
            new T.CylinderGeometry(0.22, 0.35, 8 + (i % 2) * 3, 5),
            stone,
            Math.cos(a) * 3,
            4,
            Math.sin(a) * 3,
            architecture,
          );
          mesh(
            new T.ConeGeometry(0.5, 2, 5),
            dark,
            Math.cos(a) * 3,
            9 + (i % 2),
            Math.sin(a) * 3,
            architecture,
          );
        }
        arch(architecture, 0, 2.5, w.color);
        break;
      }
      case "hidden-worlds": {
        gardenEffects.push(createHiddenWorlds(g, o.simple, invalidate));
        break;
      }
      case "your-future": {
        for (let i = 0; i < 11; i++) {
          const tx = Math.sin(i * 2.4) * 4,
            tz = Math.cos(i * 2.4) * 4,
            h = 4 + (i % 4) * 2.5;
          mesh(
            new T.BoxGeometry(0.8, h, 1),
            new T.MeshStandardMaterial({
              color: "#859db3",
              metalness: 0.7,
              roughness: 0.2,
            }),
            tx,
            h / 2,
            tz,
            architecture,
          );
          mesh(
            new T.BoxGeometry(0.04, h + 0.5, 0.04),
            luminous,
            tx + 0.42,
            (h + 0.5) / 2,
            tz + 0.51,
            architecture,
          );
        }
        const ring = mesh(
          new T.TorusGeometry(4, 0.15, 5, 48),
          stone,
          0,
          4,
          0,
          architecture,
        );
        ring.rotation.x = Math.PI / 2;
        mesh(new T.ConeGeometry(0.2, 6, 5), luminous, 0, 13, 0, architecture);
        break;
      }
      default: {
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          mesh(
            new T.BoxGeometry(0.8, 5, 1),
            stone,
            Math.cos(a) * 3.8,
            2.5,
            Math.sin(a) * 3.8,
            architecture,
          );
        }
        mesh(new T.CylinderGeometry(5, 5, 0.4, 8), gold, 0, 5, 0, architecture);
        mesh(new T.ConeGeometry(5.5, 2.4, 8), dark, 0, 6.4, 0, architecture);
        const orb = mesh(
          new T.SphereGeometry(1.5, 16, 12),
          new T.MeshBasicMaterial({ color: w.color, wireframe: true }),
          0,
          8.8,
          0,
          architecture,
        );
        animated.push(orb);
        for (let i = 0; i < 4; i++) {
          const book = mesh(
            new T.BoxGeometry(0.65, 0.12, 0.8),
            gold,
            Math.sin(i * 2) * 4,
            1.5 + i * 0.6,
            Math.cos(i * 2) * 3,
            architecture,
          );
          book.rotation.z = i * 0.3;
          animated.push(book);
        }
        arch(architecture, 0, 3, w.color);
      }
    }
    if (w.hubKey !== "hidden-worlds") architecture.scale.set(1.12, 1.4, 1.12);
    g.traverse((obj) => {
      if (obj instanceof T.Mesh) {
        obj.userData.destination = w.id;
        targets.push(obj);
      }
    });
    for (const d of o.discoveries
      .filter((d) => d.worldId === w.id)
      .slice(0, 24)) {
      const marker = mesh(
        new T.OctahedronGeometry(0.32),
        glow(w.color),
        d.position[0],
        d.position[1] + 4.5,
        d.position[2],
        g,
      );
      marker.userData.destination = w.id;
      marker.userData.discovery = d.id;
      targets.push(marker);
      animated.push(marker);
      const ring = mesh(
        new T.TorusGeometry(0.55, 0.035, 4, 20),
        glow(w.color),
        d.position[0],
        d.position[1] + 4.5,
        d.position[2],
        g,
      );
      ring.userData.destination = w.id;
      ring.userData.discovery = d.id;
      targets.push(ring);
    }
    const end = locations.get(w.id)!.clone().setY(0.02);
    const start = new T.Vector3(0, 0.02, 11);
    const bend = start.clone().lerp(end, 0.5);
    bend.x += index % 2 ? 2 : -2;
    const curve = new T.QuadraticBezierCurve3(start, bend, end);
    const points = curve.getPoints(o.simple ? 20 : 32);
    paths.set(w.id, points);
    if (w.hubKey === "hidden-worlds") {
      // Approach the garden from its real walkway, rather than landing inside the arch.
      const viewpoint = new T.Vector3(x, 0.02, z + 12);
      let nearestIndex = 0;
      points.forEach((point, i) => {
        if (
          point.distanceTo(viewpoint) <
          points[nearestIndex].distanceTo(viewpoint)
        )
          nearestIndex = i;
      });
      locations.set(
        w.id,
        new T.Vector3(points[nearestIndex].x, eye, points[nearestIndex].z),
      );
      approachEnds.set(w.id, nearestIndex + 1);
    }
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        mid = a.clone().lerp(b, 0.5);
      routeTiles.push({
        position: mid,
        length: a.distanceTo(b) + 0.08,
        angle: Math.atan2(b.x - a.x, b.z - a.z),
      });
    }
  });
  routeTiles.push({
    position: new T.Vector3(0, -0.05, (initialZ + 24) / 2),
    length: initialZ - 24 + 1,
    angle: 0,
  });
  environment.bridges(routeTiles);
  // Bounded distant islands and starfield establish depth without copying the reference image.
  for (let i = 0; i < 12; i++)
    island(
      Math.sin(i * 2.4) * 75,
      -65 - i * 4,
      4.5 + (i % 3) * 2,
      scene,
      false,
    );
  let random = 37;
  const rnd = () => {
    random = (random * 1664525 + 1013904223) >>> 0;
    return random / 4294967296;
  };
  const positions = new Float32Array((o.simple ? 350 : 1000) * 3);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (rnd() - 0.5) * 250;
    positions[i + 1] = rnd() * 90 + 12;
    positions[i + 2] = -rnd() * 180;
  }
  const starGeo = new T.BufferGeometry();
  starGeo.setAttribute("position", new T.BufferAttribute(positions, 3));
  scene.add(
    new T.Points(
      starGeo,
      new T.PointsMaterial({
        color: "#bcd6ef",
        size: 0.16,
        transparent: true,
        opacity: 0.75,
      }),
    ),
  );
  mesh(new T.SphereGeometry(6, 24, 18), glow("#adc4eb", 0.7), -8, 25, -100);
  const titles = createWorldTitles(scene, o.worlds, o.simple, invalidate);
  let focused: string | null = null;
  const keys = new Set<string>();
  let auto: T.Vector3[] = [];
  let target: string | null = null;
  let arrived: string | null = null;
  let hovered: string | null = null;
  let paused = false;
  let drag = false;
  let moved = false;
  let lastX = 0,
    lastY = 0,
    startX = 0,
    startY = 0;
  const ray = new T.Raycaster();
  const pointer = new T.Vector2();
  function onRoad(x: number, z: number) {
    if (Math.abs(x) < 2.5 && z >= 11 && z <= initialZ + 1) return true;
    if (Math.hypot(x, z - 11) < 13) return true;
    for (const w of o.worlds) {
      const p = w.hubPosition!;
      if (Math.hypot(x - p[0], z - p[2]) < 6) return true;
    }
    for (const list of paths.values())
      if (list.some((p) => Math.hypot(x - p.x, z - p.z) < 1.8)) return true;
    return false;
  }
  function go(id: string, instant = false) {
    if (
      (target === id && auto.length) ||
      (arrived === id && camera.position.distanceTo(locations.get(id)!) < 1)
    )
      return;
    const path = paths.get(id);
    if (!path) return;
    target = id;
    if (o.reduced || instant) {
      camera.position.copy(locations.get(id)!);
      auto = [];
      arrived = id;
      o.onArrive(id);
      return;
    }
    let nearPath: T.Vector3[] | undefined,
      nearest = Infinity,
      nearIndex = 0;
    for (const p of paths.values())
      for (let i = 0; i < p.length; i++) {
        const d = Math.hypot(
          camera.position.x - p[i].x,
          camera.position.z - p[i].z,
        );
        if (d < nearest) {
          nearest = d;
          nearPath = p;
          nearIndex = i;
        }
      }
    auto = [
      ...(nearPath ? nearPath.slice(0, nearIndex + 1).reverse() : []),
      ...path.slice(0, approachEnds.get(id) ?? path.length),
    ].map((p) => new T.Vector3(p.x, eye, p.z));
  }
  function pointerDown(e: PointerEvent) {
    if (paused) return;
    drag = true;
    moved = false;
    lastX = startX = e.clientX;
    lastY = startY = e.clientY;
    r.domElement.setPointerCapture(e.pointerId);
  }
  function hit(e: PointerEvent) {
    const bounds = r.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - bounds.left) / bounds.width) * 2 - 1,
      (-(e.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects(targets)[0]?.object.userData;
  }
  function pointerMove(e: PointerEvent) {
    if (paused) return;
    if (drag) {
      if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 5) {
        moved = true;
        auto = [];
      }
      yaw -= (e.clientX - lastX) * 0.003;
      pitch = T.MathUtils.clamp(pitch - (e.clientY - lastY) * 0.003, -1.1, 0.8);
      camera.rotation.set(pitch, yaw, 0);
      lastX = e.clientX;
      lastY = e.clientY;
    } else {
      const id = (hit(e)?.destination as string) || null;
      r.domElement.style.cursor = id ? "pointer" : "grab";
      if (id !== hovered) {
        hovered = id;
        titles.select(focused || hovered || arrived);
        o.onHover(id);
      }
    }
  }
  function pointerUp(e: PointerEvent) {
    if (!drag) return;
    drag = false;
    if (!moved && !paused) {
      const data = hit(e);
      if (data?.discovery) {
        o.onDiscovery(data.discovery);
        return;
      }
      if (data?.destination) {
        hovered = data.destination;
        titles.select(hovered);
        go(data.destination);
        o.onHover(data.destination);
      }
    }
  }
  function keydown(e: KeyboardEvent) {
    if (
      paused ||
      (e.target as HTMLElement).closest("input,select,textarea,[data-overlay]")
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
      auto = [];
    }
  }
  const leave = () => {
    hovered = null;
    titles.select(focused || arrived);
    o.onHover(null);
    r.domElement.style.cursor = "grab";
  };
  r.domElement.addEventListener("pointerleave", leave);
  const keyup = (e: KeyboardEvent) => keys.delete(e.key);
  const blur = () => {
    keys.clear();
    drag = false;
  };
  r.domElement.addEventListener("pointerdown", pointerDown);
  r.domElement.addEventListener("pointermove", pointerMove);
  r.domElement.addEventListener("pointerup", pointerUp);
  r.domElement.addEventListener("pointercancel", blur);
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", blur);
  const lost = (e: Event) => {
    e.preventDefault();
    o.onFail();
  };
  r.domElement.addEventListener("webglcontextlost", lost);
  const resize = new ResizeObserver(() => {
    if (host.clientWidth && host.clientHeight) {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      r.setSize(host.clientWidth, host.clientHeight);
      invalidate();
    }
  });
  resize.observe(host);
  const renderedPosition = new T.Vector3(Infinity, Infinity, Infinity);
  const renderedRotation = new T.Euler();
  let lastRender = 0;
  let firstFrame = true;
  let lastAuto = performance.now();
  let frame = 0,
    last = performance.now(),
    lastReport = 0;
  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (document.hidden) return;
    if (!paused) {
      if (auto.length) {
        // Carry distance across short path segments instead of losing time at each waypoint.
        let remaining = Math.min((now - lastAuto) / 1000, 0.1) * 12;
        while (auto.length && remaining > 0) {
          const delta = auto[0].clone().sub(camera.position),
            distance = delta.length();
          if (distance <= remaining) {
            camera.position.copy(auto.shift()!);
            remaining -= distance;
            if (!auto.length && target) {
              arrived = target;
              o.onArrive(target);
            }
          } else {
            camera.position.addScaledVector(delta, remaining / distance);
            remaining = 0;
          }
        }
      } else {
        let dx =
            Number(keys.has("d") || keys.has("ArrowRight")) -
            Number(keys.has("a") || keys.has("ArrowLeft")),
          dz =
            Number(keys.has("s") || keys.has("ArrowDown")) -
            Number(keys.has("w") || keys.has("ArrowUp"));
        const length = Math.hypot(dx, dz) || 1;
        dx /= length;
        dz /= length;
        const nx =
            camera.position.x +
            (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * dt * 9,
          nz =
            camera.position.z +
            (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * dt * 9;
        if (onRoad(nx, nz)) camera.position.set(nx, eye, nz);
      }
    }
    lastAuto = now;
    const cameraChanged =
      !camera.position.equals(renderedPosition) ||
      !camera.rotation.equals(renderedRotation);
    const shouldRender =
      dirty ||
      firstFrame ||
      cameraChanged ||
      (o.reduced && titles.busy(true)) ||
      (!o.reduced && now - lastRender >= 1000 / 30);
    if (shouldRender) {
      if (!o.reduced)
        animated.forEach((obj, i) => {
          if ((obj as T.Mesh).geometry?.type === "PlaneGeometry") {
            obj.scale.y = 1 + Math.sin(now * 0.0008 + i) * 0.035;
          } else obj.rotation.y += dt * 0.06 * (i % 2 ? 1 : -1);
        });
      titles.update(now / 1000, dt, camera, o.reduced);
      worldLights.forEach(
        (light, id) =>
          (light.intensity = id === (focused || hovered) ? 43 : 25),
      );
      environment.update(now / 1000, o.reduced);
      gardenEffects.forEach((effect) => effect.update(now / 1000, o.reduced));
      r.render(scene, camera);
      if (firstFrame) {
        firstFrame = false;
        o.onReady();
      }
      dirty = false;
      lastRender = now;
      renderedPosition.copy(camera.position);
      renderedRotation.copy(camera.rotation);
    }
    if (now - lastReport > 300) {
      lastReport = now;
      o.onPosition(camera.position.x, camera.position.z);
      camera.updateMatrixWorld();
      o.onAnchors(
        o.worlds.map((w) => {
          const p = new T.Vector3(
            w.hubPosition![0],
            5,
            w.hubPosition![2],
          ).project(camera);
          return {
            id: w.id,
            x: T.MathUtils.clamp((p.x * 0.5 + 0.5) * 100, 5, 95),
            y: T.MathUtils.clamp((-p.y * 0.5 + 0.5) * 100, 25, 80),
          };
        }),
      );
      let nearby: string | null = null;
      for (const [id, p] of locations)
        if (Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < 5)
          nearby = id;
      if (nearby !== arrived) {
        arrived = nearby;
        o.onArrive(nearby);
      }
      titles.select(focused || hovered || arrived);
    }
  }
  frame = requestAnimationFrame(tick);
  return {
    go,
    emphasize: (id: string | null) => {
      focused = id;
      titles.select(focused || hovered);
      invalidate();
    },
    setLocale: (locale: Locale) => titles.setLocale(locale),
    move: (key: string, active: boolean) => {
      auto = [];
      active ? keys.add(key) : keys.delete(key);
    },
    pause: (value: boolean) => {
      paused = value;
      keys.clear();
    },
    reset: () => {
      auto = [];
      target = null;
      camera.position.set(0, eye, initialZ);
      yaw = 0;
      pitch = -0.2;
      camera.rotation.set(pitch, yaw, 0);
      o.onArrive(null);
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      r.domElement.removeEventListener("pointerleave", leave);
      r.domElement.removeEventListener("pointerdown", pointerDown);
      r.domElement.removeEventListener("pointermove", pointerMove);
      r.domElement.removeEventListener("pointerup", pointerUp);
      r.domElement.removeEventListener("pointercancel", blur);
      r.domElement.removeEventListener("webglcontextlost", lost);
      scene.traverse((obj) => {
        const m = obj as T.Mesh;
        if (obj instanceof T.InstancedMesh) obj.dispose();
        if (m.geometry) m.geometry.dispose();
        if (m.material)
          (Array.isArray(m.material) ? m.material : [m.material]).forEach(
            (mat) => mat.dispose(),
          );
      });
      gardenEffects.forEach((effect) => effect.dispose());
      titles.dispose();
      environment.dispose();
      r.dispose();
      r.domElement.remove();
    },
  };
}
