import * as T from "three";
// Procedural scenery lives in world coordinates; no screenshot planes or fake records.
export function freeCosmos(
  scene: T.Scene,
  canvas: HTMLCanvasElement,
  tap: (e: PointerEvent) => boolean,
  obstacles: () => { center: T.Vector3; radius: number }[] = () => [],
) {
  const group = new T.Group();
  group.visible = false;
  scene.add(group);
  const camera = new T.PerspectiveCamera(58, 1, 0.1, 550);
  camera.position.set(0, 5, 32);
  const keys = new Set<string>(),
    pointers = new Map<number, { x: number; y: number }>();
  let enabled = false,
    yaw = 0,
    pitch = 0,
    moved = false,
    distance = 0,
    last = 0;
  const solids: { center: T.Vector3; radius: number }[] = [];
  const textures: T.Texture[] = [];
  const rock = new T.TextureLoader().load(
    "/assets/hidden-worlds/mossy-rock-diff-1k.jpg",
  );
  rock.colorSpace = T.SRGBColorSpace;
  textures.push(rock);
  const stone = new T.MeshStandardMaterial({
    map: rock,
    color: "#586f94",
    roughness: 0.9,
  });
  const silver = new T.MeshStandardMaterial({
    color: "#9aafda",
    metalness: 0.65,
    roughness: 0.3,
  });
  const glow = new T.MeshBasicMaterial({ color: "#90dfff" });
  function mesh(
    geo: T.BufferGeometry,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = group,
  ) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  // Ringed planet: sphere with a generated surface texture, viewed from every angle.
  const surface = document.createElement("canvas");
  surface.width = 512;
  surface.height = 256;
  const ctx = surface.getContext("2d")!;
  ctx.fillStyle = "#173763";
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 1600; i++) {
    const x = (i * 131.73) % 512,
      y = (i * 61.17) % 256;
    ctx.fillStyle = i % 3 ? "#284d7d" : "#6b95bd";
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.ellipse(x, y, 8 + (i % 29), 1 + (i % 6), 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  const surfaceTexture = new T.CanvasTexture(surface);
  surfaceTexture.colorSpace = T.SRGBColorSpace;
  textures.push(surfaceTexture);
  const planet = mesh(
    new T.SphereGeometry(14, 64, 40),
    new T.MeshStandardMaterial({ map: surfaceTexture, roughness: 0.8 }),
    -38,
    17,
    -65,
  );
  planet.name = "Ringed planet";
  solids.push({ center: planet.position.clone(), radius: 15 });
  const rings = mesh(
    new T.RingGeometry(17, 24, 128),
    new T.MeshStandardMaterial({
      color: "#91a5e8",
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.45,
      metalness: 0.4,
      roughness: 0.5,
    }),
    -38,
    17,
    -65,
  );
  rings.rotation.set(1.12, 0.2, 0.3);
  for (let i = 0; i < 4; i++) {
    const p = mesh(
      new T.SphereGeometry(2 + i * 0.5, 28, 20),
      new T.MeshStandardMaterial({
        map: surfaceTexture,
        color: i % 2 ? "#a48cce" : "#4d91b8",
      }),
      18 - i * 14,
      16 - i * 7,
      -40 - i * 22,
    );
    solids.push({ center: p.position.clone(), radius: 3 + i * 0.5 });
  }
  // Irregular layered rock volumes with towers, buttresses and crystal clusters.
  const locations = [
    [-20, -7, -14],
    [24, -9, -35],
    [-8, 2, -55],
    [40, 3, -82],
    [-39, -13, -92],
  ];
  for (let n = 0; n < locations.length; n++) {
    const [x, y, z] = locations[n];
    const island = new T.Group();
    island.position.set(x, y, z);
    group.add(island);
    const geo = new T.CylinderGeometry(7, 1, 9, 17, 5);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i),
        py = pos.getY(i),
        pz = pos.getZ(i);
      const a = Math.atan2(pz, px);
      const f =
        1 + 0.12 * Math.sin(a * 7 + py * 1.3 + n) + 0.08 * Math.cos(a * 11);
      pos.setXYZ(i, px * f, py, pz * f);
    }
    geo.computeVertexNormals();
    mesh(geo, stone, 0, -4.5, 0, island);
    solids.push({ center: new T.Vector3(x, y - 4, z), radius: 7.7 });
    solids.push({ center: new T.Vector3(x, y + 4, z), radius: 5 });
    island.name = "Celestial island " + (n + 1);
    for (let t = 0; t < 7; t++) {
      const angle = t * 2.399,
        r = t ? 2.8 : 0,
        h = t ? 3 + (t % 3) * 1.4 : 8;
      const tx = Math.cos(angle) * r,
        tz = Math.sin(angle) * r;
      mesh(new T.BoxGeometry(0.9, h, 0.9), silver, tx, h / 2, tz, island);
      mesh(new T.ConeGeometry(0.85, 2.6, 6), silver, tx, h + 1.3, tz, island);
      for (let k = 0; k < 3; k++)
        mesh(
          new T.BoxGeometry(0.14, 0.8, 0.05),
          glow,
          tx - 0.27 + k * 0.27,
          h * 0.64,
          tz + 0.46,
          island,
        );
      for (let k = 0; k < 4; k++) {
        const b = mesh(
          new T.BoxGeometry(0.2, h * 0.7, 0.2),
          stone,
          tx + Math.cos((k * Math.PI) / 2) * 0.62,
          h * 0.3,
          tz + Math.sin((k * Math.PI) / 2) * 0.62,
          island,
        );
        b.rotation.z = Math.cos((k * Math.PI) / 2) * 0.13;
      }
    }
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4;
      const crystal = mesh(
        new T.OctahedronGeometry(0.5 + (k % 3) * 0.2),
        new T.MeshStandardMaterial({
          color: k % 2 ? "#9875ee" : "#6deaff",
          emissive: k % 2 ? "#5538a8" : "#1377aa",
          emissiveIntensity: 0.7,
          metalness: 0.4,
          roughness: 0.2,
        }),
        Math.cos(a) * 5,
        0.6,
        Math.sin(a) * 5,
        island,
      );
      crystal.scale.y = 2.5;
    }
  }
  const portal = new T.Group();
  portal.name = "Energy portal";
  portal.position.set(9, 2, -22);
  group.add(portal);
  for (let i = 0; i < 3; i++) {
    const ring = mesh(
      new T.TorusGeometry(4 - i * 0.5, 0.1 + i * 0.04, 12, 96),
      i ? glow : silver,
      0,
      0,
      -i * 0.2,
      portal,
    );
    ring.rotation.z = i * 0.2;
  }
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const block = mesh(
      new T.BoxGeometry(0.5, 0.8, 0.7),
      silver,
      Math.sin(a) * 4.4,
      Math.cos(a) * 4.4,
      0,
      portal,
    );
    block.rotation.z = -a;
  }
  const energy = mesh(
    new T.CircleGeometry(3, 64),
    new T.MeshBasicMaterial({
      color: "#7565ef",
      transparent: true,
      opacity: 0.18,
      side: T.DoubleSide,
      depthWrite: false,
    }),
    0,
    0,
    0,
    portal,
  );
  const portalLight = new T.PointLight("#79b7ff", 55, 25);
  portal.add(portalLight);
  // Volumetric depth comes from many distinct world coordinates, not camera-relative layers.
  const starsGeometry = new T.BufferGeometry(),
    positions = new Float32Array(2500 * 3);
  for (let i = 0; i < 2500; i++) {
    positions[i * 3] = Math.sin(i * 73.13) * 220;
    positions[i * 3 + 1] = Math.sin(i * 17.53) * 160;
    positions[i * 3 + 2] = Math.cos(i * 37.17) * 220;
  }
  starsGeometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  const stars = new T.Points(
    starsGeometry,
    new T.PointsMaterial({
      color: "#bddcff",
      size: 0.4,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    }),
  );
  group.add(stars);
  const galaxyGeo = new T.BufferGeometry(),
    gp = new Float32Array(1400 * 3);
  for (let i = 0; i < 1400; i++) {
    const r = Math.sqrt(i / 1400) * 30,
      a = i * 2.399 + r * 0.27;
    gp[i * 3] = Math.cos(a) * r;
    gp[i * 3 + 1] = Math.sin(i * 53) * 0.65;
    gp[i * 3 + 2] = Math.sin(a) * r * 0.65;
  }
  galaxyGeo.setAttribute("position", new T.BufferAttribute(gp, 3));
  const galaxy = new T.Points(
    galaxyGeo,
    new T.PointsMaterial({
      color: "#c2a9ff",
      size: 0.38,
      transparent: true,
      opacity: 0.8,
      blending: T.AdditiveBlending,
      depthWrite: false,
    }),
  );
  galaxy.position.set(16, 23, -95);
  galaxy.rotation.x = 0.55;
  group.add(galaxy);
  const soft = document.createElement("canvas");
  soft.width = soft.height = 64;
  const c = soft.getContext("2d")!,
    gradient = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, "#ffffff00");
  c.fillStyle = gradient;
  c.fillRect(0, 0, 64, 64);
  const mistTexture = new T.CanvasTexture(soft);
  textures.push(mistTexture);
  const mist: T.Sprite[] = [];
  for (let i = 0; i < 12; i++) {
    const s = new T.Sprite(
      new T.SpriteMaterial({
        map: mistTexture,
        color: i % 2 ? "#4257ac" : "#6d368e",
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    s.position.set(
      Math.sin(i * 2.4) * 65,
      Math.cos(i * 1.7) * 35,
      -35 - i * 10,
    );
    s.scale.set(42, 22, 1);
    group.add(s);
    mist.push(s);
  }
  const core = new T.Sprite(
    new T.SpriteMaterial({
      map: mistTexture,
      color: "#b8baff",
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  core.position.set(16, 23, -95);
  core.scale.set(18, 12, 1);
  group.add(core);
  const streak = mesh(
    new T.CylinderGeometry(0.025, 0.025, 6, 5),
    glow,
    0,
    25,
    -60,
  );
  streak.rotation.z = -0.8;
  const direction = new T.Vector3(),
    previous = new T.Vector3();
  function translate(x: number, y: number, z: number) {
    previous.copy(camera.position);
    direction.set(x, y, z).applyQuaternion(camera.quaternion);
    camera.position.add(direction);
    camera.position.clampScalar(-210, 210);
    if (
      [...solids, ...obstacles()].some(
        (s) => camera.position.distanceTo(s.center) < s.radius + 1.2,
      )
    )
      camera.position.copy(previous);
  }
  function down(e: PointerEvent) {
    if (!enabled || e.button > 0) return;
    canvas.focus();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    distance = 0;
    canvas.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!enabled || !pointers.has(e.pointerId)) return;
    const old = pointers.get(e.pointerId)!;
    const dx = e.clientX - old.x,
      dy = e.clientY - old.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.hypot(dx, dy) > 2) moved = true;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()],
        d = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance) translate(-dx * 0.015, dy * 0.015, (distance - d) * 0.055);
      distance = d;
    } else {
      yaw -= dx * 0.004;
      pitch = T.MathUtils.clamp(pitch - dy * 0.004, -1.45, 1.45);
      camera.rotation.set(pitch, yaw, 0, "YXZ");
    }
  }
  function up(e: PointerEvent) {
    if (!enabled) return;
    const was = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (was && !moved && e.type === "pointerup" && !tap(e)) {
      const rect = canvas.getBoundingClientRect(),
        ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((e.clientY - rect.top) / rect.height) * 2,
        ),
        camera,
      );
      const hit = ray
        .intersectObjects(group.children, true)
        .find((h) => h.object instanceof T.Mesh);
      if (hit) {
        let object = hit.object;
        while (object.parent && object.parent !== group) object = object.parent;
        const sphere = new T.Box3()
          .setFromObject(object)
          .getBoundingSphere(new T.Sphere());
        camera.position
          .copy(sphere.center)
          .add(new T.Vector3(0, 2, Math.max(10, sphere.radius * 2.8)));
        camera.lookAt(sphere.center);
        yaw = camera.rotation.y;
        pitch = camera.rotation.x;
        canvas.dataset.landmark = object.name || "Celestial object";
      }
    }
    distance = 0;
  }
  function wheel(e: WheelEvent) {
    if (!enabled) return;
    e.preventDefault();
    translate(0, 0, T.MathUtils.clamp(e.deltaY * 0.02, -5, 5));
  }
  function key(e: KeyboardEvent) {
    if (
      !enabled || e.ctrlKey || e.metaKey || e.altKey ||
      !!document.querySelector('[role="dialog"][aria-modal="true"]') ||
      /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName) ||
      (e.target as HTMLElement)?.isContentEditable
    )
      return;
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "q",
        "e",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        "shift",
      ].includes(e.key.toLowerCase())
    ) {
      e.preventDefault();
      keys.add(e.key.toLowerCase());
    }
  }
  const release = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase()),
    blur = () => {
      keys.clear();
      pointers.clear();
    };
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "3D flight: drag to look; WASD to move, Q/E vertical; wheel forward/back; touch drag and two-finger travel",
  );
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  window.addEventListener("keydown", key);
  window.addEventListener("keyup", release);
  window.addEventListener("blur", blur);
  return {
    camera,
    mode(value: boolean) {
      enabled = value;
      group.visible = value;
      blur();
    },
    resize(w: number, h: number) {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    focus(p: T.Vector3) {
      camera.position.copy(p).add(new T.Vector3(0, 2, 9));
      camera.lookAt(p);
      yaw = camera.rotation.y;
      pitch = camera.rotation.x;
    },
    reset() {
      camera.position.set(0, 5, 32);
      yaw = pitch = 0;
      camera.rotation.set(0, 0, 0);
    },
    get moving() {
      return enabled && keys.size > 0;
    },
    update(now: number, reduced: boolean) {
      const dt = Math.min(0.06, (now - last) / 1000 || 0);
      last = now;
      if (!enabled) return;
      const speed = dt * (keys.has("shift") ? 20 : 9);
      translate(
        (Number(keys.has("d")) - Number(keys.has("a"))) * speed,
        (Number(keys.has("e")) - Number(keys.has("q"))) * speed,
        (Number(keys.has("s") || keys.has("arrowdown")) -
          Number(keys.has("w") || keys.has("arrowup"))) *
          speed,
      );
      if (keys.has("arrowleft")) yaw += dt;
      if (keys.has("arrowright")) yaw -= dt;
      camera.rotation.set(pitch, yaw, 0, "YXZ");
      if (reduced) streak.visible = false;
      if (!reduced) {
        planet.rotation.y = now * 0.000015;
        portal.children[1].rotation.z = now * 0.0002;
        portal.children[2].rotation.z = -now * 0.00015;
        energy.scale.setScalar(1 + Math.sin(now * 0.001) * 0.04);
        galaxy.rotation.y = now * 0.000008;
        (stars.material as T.PointsMaterial).opacity =
          0.72 + Math.sin(now * 0.0008) * 0.12;
        mist.forEach(
          (s, i) => (s.position.y += Math.sin(now * 0.0002 + i) * 0.001),
        );
        streak.visible = now % 17000 < 1200;
        streak.position.x = -25 + (now % 17000) * 0.035;
      }
      canvas.dataset.flight = [
        camera.position.x,
        camera.position.y,
        camera.position.z,
        yaw,
        pitch,
      ]
        .map((n) => n.toFixed(3))
        .join(",");
      canvas.dataset.projection = enabled ? "perspective" : "orthographic";
      canvas.dataset.spaceObjects = String(group.children.length);
    },
    dispose() {
      scene.remove(group);
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>();
      group.traverse((o) => {
        if (o instanceof T.Mesh || o instanceof T.Points) {
          geometries.add(o.geometry);
          const m = o.material;
          Array.isArray(m)
            ? m.forEach((x) => materials.add(x))
            : materials.add(m);
        } else if (o instanceof T.Sprite) materials.add(o.material);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", blur);
    },
  };
}
