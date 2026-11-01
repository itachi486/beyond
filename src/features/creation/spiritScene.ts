import { freeCosmos } from "./freeCosmos";
import { spiritAtmosphere } from "./spiritAtmosphere";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { getAsset, assetObject, disposeAsset } from "./uploadAssets";
import * as T from "three";
import type { Character, SpiritGraph } from "./spiritModel";
type Options = {
  select: (id: string, edge?: boolean) => void;
  move: (id: string, p: Character["position"]) => void;
  anchors: (
    points: { id: string; x: number; y: number; offset: number }[],
  ) => void;
  fail: () => void;
  sceneryError?: () => void;
  assetError?: (id: string) => void;
  assetReady?: (id: string) => void;
};
export function createSpiritScene(host: HTMLElement, options: Options) {
  const scene = new T.Scene();
  scene.background = new T.Color("#080d20");
  scene.fog = new T.FogExp2("#080d20", 0.006);
  const camera = new T.OrthographicCamera(-16, 16, 10, -10, 0.1, 100);
  camera.position.set(0, 0, 35);
  camera.lookAt(0, 0, 0);
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, innerWidth < 700 ? 1 : 1.5),
  );
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.appendChild(renderer.domElement);
  scene.add(new T.HemisphereLight("#c3e0ff", "#262044", 2.1));
  const key = new T.DirectionalLight("#eee0ff", 3);
  key.position.set(5, 8, 12);
  scene.add(key);
  const rim = new T.DirectionalLight("#6ccde0", 2);
  rim.position.set(-8, 0, 5);
  scene.add(rim);
  const root = new T.Group();
  scene.add(root);
  const atmosphere = spiritAtmosphere(scene, options.sceneryError, () => {
    dirty = true;
  });
  let fitX = 10,
    fitY = 7;
  let graph: SpiritGraph = { characters: [], connections: [], contents: [] },
    selected: string | null = null,
    edgeSelected: string | null = null,
    reduced = false,
    explore = false,
    discoveryMode = false,
    zoom = 1,
    targetZoom = 1,
    hovered: string | null = null,
    frame = 0,
    last = 0,
    disposed = false,
    serial = 0,
    dirty = true;
  const models = new Map<string, T.Group>(),
    links = new Map<
      string,
      { line: T.Line; curve: T.CatmullRomCurve3; bead: T.Mesh }
    >();
  const ray = new T.Raycaster();
  ray.params.Line = { threshold: 0.18 };
  const pointer = new T.Vector2();
  const anchorPoints: { id: string; x: number; y: number; offset: number }[] =
    [];
  const projected = new T.Vector3();
  const speeds: Record<string, number> = {
    world: 0.8,
    collector: 1.1,
    creator: 1.4,
    portal: 0.65,
    custom: 1.05,
  };
  const cosmos = freeCosmos(
    scene,
    renderer.domElement,
    (event) => {
      const hit = pick(event);
      if (hit?.object.userData.edge)
        options.select(hit.object.userData.edge, true);
      else options.select(hit?.object.userData.id || "");
      dirty = true;
      return !!hit;
    },
    () =>
      [...models.values()].map((g) => ({
        center: g.position,
        radius: Math.max(1, g.scale.x * 1.5),
      })),
  );
  const viewCamera = () => (discoveryMode ? cosmos.camera : camera);
  function publishAnchors() {
    let index = 0;
    for (const [id, g] of models) {
      projected.copy(g.position).project(viewCamera());
      const point =
        anchorPoints[index] ||
        (anchorPoints[index] = { id, x: 0, y: 0, offset: 0 });
      point.id = id;
      point.x =
        projected.z < -1 || projected.z > 1 ? -999 : (projected.x + 1) * 50;
      point.y = (1 - projected.y) * 50;
      point.offset =
        (1.5 * g.scale.y * host.clientHeight) / (camera.top - camera.bottom) +
        10;
      index++;
    }
    anchorPoints.length = index;
    options.anchors(anchorPoints);
  }

  let drag: {
    id: string;
    start: T.Vector3;
    position: T.Vector3;
    pointer: number;
    moved: boolean;
  } | null = null;
  const travel = new T.Vector2();
  let flying = false;
  const touches = new Map<number, { x: number; y: number }>();
  let gesture: {
    x: number;
    y: number;
    distance: number;
    startX: number;
    startY: number;
    moved: boolean;
    id: string | null;
  } | null = null;
  function cancelTravel() {
    flying = false;
  }
  const textures = new Map<string, T.Texture>(),
    pendingTextures = new Map<string, Promise<T.Texture>>();
  function imageTexture(url: string) {
    if (textures.has(url)) return Promise.resolve(textures.get(url)!);
    if (pendingTextures.has(url)) return pendingTextures.get(url)!;
    const request = new Promise<T.Texture>((resolve, reject) =>
      new T.TextureLoader().load(
        url,
        (texture) => {
          pendingTextures.delete(url);
          if (disposed || !graph.characters.some((c) => c.imageUrl === url)) {
            texture.dispose();
            reject(Error("cancelled"));
            return;
          }
          texture.colorSpace = T.SRGBColorSpace;
          textures.set(url, texture);
          resolve(texture);
        },
        undefined,
        () => {
          pendingTextures.delete(url);
          reject(Error("unavailable"));
        },
      ),
    );
    pendingTextures.set(url, request);
    return request;
  }
  const uploadTemplates = new Map<string, T.Group>(),
    uploadPending = new Map<string, Promise<T.Group>>();
  async function uploadedObject(id: string) {
    let template = uploadTemplates.get(id);
    if (!template) {
      let request = uploadPending.get(id);
      if (!request) {
        request = getAsset(id)
          .then(async (asset) => {
            if (!asset) throw Error("missing_asset");
            const object = await assetObject(asset);
            if (disposed) {
              disposeAsset(object);
              throw Error("cancelled");
            }
            uploadTemplates.set(id, object);
            uploadPending.delete(id);
            return object;
          })
          .catch((e) => {
            uploadPending.delete(id);
            throw e;
          });
        uploadPending.set(id, request);
      }
      template = await request;
    }
    const object = cloneSkeleton(template) as T.Group;
    const clonedTextures = new Map<T.Texture, T.Texture>();
    object.traverse((o) => {
      const m = o as T.Mesh;
      if (m.geometry) m.geometry = m.geometry.clone();
      if (m.material) {
        const copy = (mat: T.Material) => {
          const result = mat.clone(),
            record = result as unknown as Record<string, unknown>;
          for (const [key, value] of Object.entries(result))
            if (value instanceof T.Texture) {
              let t = clonedTextures.get(value);
              if (!t) {
                t = value.clone();
                clonedTextures.set(value, t);
              }
              record[key] = t;
            }
          return result;
        };
        m.material = Array.isArray(m.material)
          ? m.material.map(copy)
          : copy(m.material);
      }
    });
    return object;
  }
  function clean(group: T.Object3D) {
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>();
    group.traverse((o) => {
      const m = o as T.Mesh;
      if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
      if (m.geometry) geometries.add(m.geometry);
      if (m.material)
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) =>
          materials.add(mat),
        );
    });
    geometries.forEach((g) => g.dispose());
    const importedTextures = new Set<T.Texture>();
    materials.forEach((m) => {
      for (const value of Object.values(m))
        if (
          value instanceof T.Texture &&
          ![...textures.values()].includes(value)
        )
          importedTextures.add(value);
      m.dispose();
    });
    importedTextures.forEach((texture) => texture.dispose());
  }
  function model(c: Character) {
    const g = new T.Group(),
      color = new T.Color(c.appearance.color),
      tone =
        c.appearance.preset === "ember"
          ? new T.Color("#e6ad73")
          : c.appearance.preset === "starlight"
            ? new T.Color("#c4d9ef")
            : color;
    const crystal = new T.MeshPhysicalMaterial({
      color: tone,
      metalness: 0.35,
      roughness: 0.17,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.88,
      emissive: color,
      emissiveIntensity: 0.12,
    });
    const light = new T.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: T.AdditiveBlending,
      depthWrite: false,
    });
    const gold = new T.MeshStandardMaterial({
      color: "#c8aa75",
      metalness: 0.8,
      roughness: 0.27,
    });
    function mesh(
      geometry: T.BufferGeometry,
      material: T.Material,
      x = 0,
      y = 0,
      z = 0,
    ) {
      const m = new T.Mesh(geometry, material);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    }
    if (c.uploadedAssetId) {
      const ticket = serial;
      void uploadedObject(c.uploadedAssetId)
        .then((object) => {
          if (disposed || ticket !== serial) {
            disposeAsset(object);
            return;
          }
          if (c.uploadedKind === "image")
            object.traverse((child) => {
              if (child instanceof T.Mesh) {
                const materials = Array.isArray(child.material)
                  ? child.material
                  : [child.material];
                materials.forEach((material) => {
                  material.toneMapped = false;
                  if (material instanceof T.MeshBasicMaterial)
                    material.alphaTest = 0.001;
                  material.needsUpdate = true;
                });
              }
            });
          g.add(object);
          options.assetReady?.(c.id);
          dirty = true;
        })
        .catch(() => {
          if (!disposed && ticket === serial) options.assetError?.(c.id);
        });
      const halo = mesh(
        new T.TorusGeometry(1.8, 0.018, 5, 64),
        light,
        0,
        0,
        -0.15,
      );
      halo.name = "selection-halo";
      halo.visible = c.id === selected;
      if (c.type === "portal") {
        const energy = mesh(
          new T.TorusGeometry(1.95, 0.022, 6, 80),
          new T.MeshBasicMaterial({
            color: "#f5d48f",
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
            blending: T.AdditiveBlending,
          }),
          0,
          0,
          -0.12,
        );
        energy.name = "portal-energy";
      }
      g.scale.setScalar(c.appearance.scale);
      g.position.set(c.position.x, c.position.y, c.position.z);
      g.userData = { id: c.id, base: { ...c.position }, type: c.type };
      g.traverse((o) => {
        o.userData.id = c.id;
      });
      // Loaded children inherit pick identity when attached asynchronously.
      const add = g.add.bind(g);
      g.add = (...objects) => {
        objects.forEach((o) =>
          o.traverse((child) => {
            child.userData.id = c.id;
          }),
        );
        return add(...objects);
      };
      return g;
    }
    if (c.imageUrl) {
      const ticket = serial;
      const picture = new T.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        alphaTest: 0.001,
        toneMapped: false,
        depthWrite: false,
        side: T.DoubleSide,
      });
      const plane = mesh(
        new T.PlaneGeometry(3.4, 3.4, 1, 1),
        picture,
        0,
        0.1,
        0,
      );
      const back = mesh(
        new T.PlaneGeometry(3.6, 3.6),
        new T.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          blending: T.AdditiveBlending,
          depthWrite: false,
        }),
        0,
        0.1,
        -0.08,
      );
      back.name = "image-aura";
      void imageTexture(c.imageUrl)
        .then((texture) => {
          if (disposed || ticket !== serial) return;
          picture.map = texture;
          picture.opacity = 1;
          picture.needsUpdate = true;
          dirty = true;
        })
        .catch(() => {
          if (!disposed && ticket === serial) options.assetError?.(c.id);
        });
      const ribbon = mesh(
        new T.TorusGeometry(1.4, 0.015, 5, 64),
        light,
        0,
        -0.5,
        -0.15,
      );
      ribbon.rotation.x = 1.2;
      const halo = mesh(
        new T.TorusGeometry(1.6, 0.025, 5, 64),
        light,
        0,
        0.1,
        -0.2,
      );
      halo.name = "selection-halo";
      halo.visible = c.id === selected;
      const sparkle = new T.Points(
        new T.BufferGeometry().setFromPoints(
          Array.from(
            { length: 16 },
            (_, i) =>
              new T.Vector3(
                Math.cos(i * 2.4) * 1.6,
                Math.sin(i * 2.4) * 1.7,
                0.1,
              ),
          ),
        ),
        new T.PointsMaterial({
          color,
          size: 0.035,
          transparent: true,
          opacity: 0.55,
        }),
      );
      g.add(sparkle);
      sparkle.name = "image-sparks";
      g.scale.setScalar(c.appearance.scale);
      g.position.set(c.position.x, c.position.y, c.position.z);
      g.userData = {
        id: c.id,
        base: { ...c.position },
        type: c.type,
        animation: c.animationPreset,
      };
      g.traverse((o) => {
        o.userData.id = c.id;
      });
      return g;
    }
    // Sculpted cloak, faceted face and luminous eyes form a spirit, not a flat node.
    const profile = [
      new T.Vector2(0.05, -1.1),
      new T.Vector2(0.58, -0.9),
      new T.Vector2(0.35, -0.45),
      new T.Vector2(0.27, 0.05),
      new T.Vector2(0.44, 0.37),
      new T.Vector2(0.17, 0.55),
    ];
    mesh(new T.LatheGeometry(profile, 14), crystal);
    mesh(new T.IcosahedronGeometry(0.36, 1), crystal, 0, 0.69, 0).scale.set(
      0.82,
      1.1,
      0.8,
    );
    [-0.11, 0.11].forEach((x) =>
      mesh(new T.OctahedronGeometry(0.055, 0), light, x, 0.72, 0.29),
    );
    const orbit = mesh(
      new T.TorusGeometry(0.8, 0.018, 6, 56),
      gold,
      0,
      -0.12,
      0,
    );
    orbit.rotation.x = 1.12;
    orbit.rotation.y = 0.35;
    const ribbonPoints = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 39) * Math.PI * 3;
      return new T.Vector3(
        Math.cos(a) * (0.55 + i * 0.007),
        -0.9 + i * 0.05,
        Math.sin(a) * 0.5,
      );
    });
    mesh(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(ribbonPoints),
        55,
        0.018,
        5,
        false,
      ),
      light,
    );
    if (c.type === "world") {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const petal = mesh(
          new T.OctahedronGeometry(0.42, 0),
          crystal,
          Math.cos(a) * 0.85,
          Math.sin(a) * 0.7 + 0.4,
          -0.3,
        );
        petal.scale.set(0.45, 1.6, 0.3);
        petal.rotation.z = a - Math.PI / 2;
      }
      mesh(new T.TorusGeometry(0.63, 0.035, 6, 48), gold, 0, 0.6, -0.2);
    } else if (c.type === "collector") {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const book = new T.Group();
        const cover = new T.Mesh(new T.BoxGeometry(0.37, 0.5, 0.12), gold);
        book.add(cover);
        const pages = new T.Mesh(
          new T.BoxGeometry(0.3, 0.43, 0.13),
          new T.MeshStandardMaterial({ color: "#e6d9be" }),
        );
        book.add(pages);
        book.position.set(
          Math.cos(a) * 0.95,
          Math.sin(a) * 0.6,
          Math.sin(a) * 0.4,
        );
        book.rotation.z = a * 0.25;
        g.add(book);
      }
      mesh(new T.TorusGeometry(1.04, 0.02, 6, 64), light).rotation.x = 0.7;
    } else if (c.type === "creator") {
      const shape = new T.Shape();
      shape.moveTo(0, -0.65);
      shape.bezierCurveTo(-0.7, 0.1, -0.45, 0.9, 0.15, 1.1);
      shape.bezierCurveTo(0.58, 0.45, 0.35, -0.1, 0, -0.65);
      const feather = mesh(
        new T.ExtrudeGeometry(shape, {
          depth: 0.07,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.04,
          bevelThickness: 0.04,
        }),
        crystal,
        0.74,
        0.08,
        0,
      );
      feather.rotation.z = -0.4;
      mesh(
        new T.CylinderGeometry(0.022, 0.022, 1.65, 6),
        gold,
        0.9,
        0.15,
        0.12,
      ).rotation.z = -0.25;
    } else if (c.type === "portal") {
      const hoop = mesh(
        new T.TorusGeometry(0.97, 0.13, 8, 64),
        crystal,
        0,
        0.1,
        -0.3,
      );
      hoop.scale.y = 1.3;
      mesh(
        new T.TorusGeometry(0.8, 0.025, 6, 60),
        light,
        0,
        0.1,
        -0.26,
      ).scale.y = 1.35;
      [-0.8, 0.8].forEach((x) =>
        mesh(new T.OctahedronGeometry(0.23, 0), gold, x, -0.8, -0.2),
      );
    } else {
      const knot = mesh(
        new T.TorusKnotGeometry(0.7, 0.055, 75, 7, 2, 3),
        light,
        0,
        0.1,
        -0.3,
      );
      knot.rotation.x = 0.8;
      [-0.6, 0.6].forEach((x) => {
        const horn = mesh(
          new T.OctahedronGeometry(0.4, 0),
          crystal,
          x,
          0.7,
          -0.2,
        );
        horn.scale.set(0.4, 1.6, 0.4);
        horn.rotation.z = -x;
      });
    }
    const halo = mesh(
      new T.TorusGeometry(1.25, 0.018, 5, 64),
      light,
      0,
      0,
      -0.4,
    );
    halo.name = "selection-halo";
    halo.visible = c.id === selected;
    g.scale.setScalar(c.appearance.scale);
    g.position.set(c.position.x, c.position.y, c.position.z);
    g.userData = { id: c.id, base: { ...c.position }, type: c.type };
    g.traverse((o) => {
      o.userData.id = c.id;
    });
    return g;
  }
  function path(a: T.Vector3, b: T.Vector3) {
    const midpoint = a.clone().lerp(b, 0.5);
    midpoint.y += Math.min(1.6, a.distanceTo(b) * 0.18);
    midpoint.z += 0.35;
    return new T.CatmullRomCurve3([a, midpoint, b]);
  }
  function build(next: SpiritGraph) {
    serial++;
    const countChanged = graph.characters.length !== next.characters.length;
    graph = next;
    if (graph.characters.length) {
      const xs = graph.characters.map((c) => c.position.x),
        ys = graph.characters.map((c) => c.position.y);
      fitX = Math.max(6, (Math.max(...xs) - Math.min(...xs)) / 2 + 2.6);
      fitY = Math.max(5, (Math.max(...ys) - Math.min(...ys)) / 2 + 2.6);
      if (countChanged) {
        camera.position.x = (Math.max(...xs) + Math.min(...xs)) / 2;
        camera.position.y = (Math.max(...ys) + Math.min(...ys)) / 2;
      }
    } else {
      fitX = 10;
      fitY = 7;
    }
    resize();
    clean(root);
    root.clear();
    for (const [url, texture] of textures)
      if (!graph.characters.some((c) => c.imageUrl === url)) {
        texture.dispose();
        textures.delete(url);
      }
    models.clear();
    links.clear();
    for (const c of graph.characters) {
      const g = model(c);
      models.set(c.id, g);
      root.add(g);
    }
    for (const e of graph.connections) {
      const a = models.get(e.sourceCharacterId),
        b = models.get(e.targetCharacterId);
      if (!a || !b) continue;
      const curve = path(a.position, b.position);
      const line = new T.Line(
        new T.BufferGeometry().setFromPoints(curve.getPoints(40)),
        new T.LineBasicMaterial({
          color: e.id === edgeSelected ? "#ffe5a2" : "#7ed2ef",
          transparent: true,
          opacity: 0.7,
        }),
      );
      line.userData = { edge: e.id };
      root.add(line);
      const bead = new T.Mesh(
        new T.OctahedronGeometry(0.065),
        new T.MeshBasicMaterial({ color: "#e5cda5" }),
      );
      root.add(bead);
      links.set(e.id, { line, curve, bead });
    }
    dirty = true;
  }
  function pick(e: PointerEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, viewCamera());
    return ray
      .intersectObjects(root.children, true)
      .find((hit) => hit.object.userData.id || hit.object.userData.edge);
  }
  function planePoint(e: PointerEvent, z = 0) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, viewCamera());
    const out = new T.Vector3();
    ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 0, 1), -z), out);
    return out;
  }
  function down(e: PointerEvent) {
    if (discoveryMode) return;
    if (discoveryMode) {
      cancelTravel();
      const hit = pick(e);
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const values = [...touches.values()];
      gesture = {
        x: e.clientX,
        y: e.clientY,
        distance:
          values.length === 2
            ? Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y)
            : 0,
        startX: e.clientX,
        startY: e.clientY,
        moved: values.length > 1,
        id: hit?.object.userData.id || null,
      };
      renderer.domElement.setPointerCapture(e.pointerId);
      return;
    }
    const hit = pick(e);
    if (!hit) {
      options.select("");
      return;
    }
    if (hit.object.userData.edge) {
      options.select(hit.object.userData.edge, true);
      return;
    }
    const id = hit.object.userData.id as string;
    options.select(id);
    if (explore) return;
    const g = models.get(id)!;
    drag = {
      id,
      start: planePoint(e, g.position.z),
      position: new T.Vector3(
        g.userData.base.x,
        g.userData.base.y,
        g.userData.base.z,
      ),
      pointer: e.pointerId,
      moved: false,
    };
    renderer.domElement.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (discoveryMode) {
      dirty = true;
      return;
    }
    if (discoveryMode && gesture && touches.has(e.pointerId)) {
      const old = touches.get(e.pointerId)!;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (gesture.distance > 0)
          targetZoom = T.MathUtils.clamp(
            (targetZoom * distance) / gesture.distance,
            0.6,
            2,
          );
        gesture.distance = distance;
        gesture.moved = true;
      } else {
        const r = renderer.domElement.getBoundingClientRect();
        camera.position.x -=
          ((e.clientX - old.x) * (camera.right - camera.left)) / r.width;
        camera.position.y +=
          ((e.clientY - old.y) * (camera.top - camera.bottom)) / r.height;
        camera.position.x = T.MathUtils.clamp(camera.position.x, -40, 40);
        camera.position.y = T.MathUtils.clamp(camera.position.y, -30, 30);
        if (
          Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > 5
        )
          gesture.moved = true;
      }
      camera.lookAt(camera.position.x, camera.position.y, 0);
      dirty = true;
      return;
    }
    const hit = pick(e);
    hovered = hit?.object.userData.id || null;
    renderer.domElement.style.cursor = hovered
      ? "pointer"
      : explore
        ? "grab"
        : "default";
    dirty = true;
    if (!drag) return;
    const p = planePoint(e, drag.position.z).sub(drag.start).add(drag.position);
    p.x = T.MathUtils.clamp(p.x, -16, 16);
    p.y = T.MathUtils.clamp(p.y, -10, 10);
    const g = models.get(drag.id);
    if (g) {
      g.position.copy(p);
      g.userData.base = { x: p.x, y: p.y, z: p.z };
      drag.moved = drag.moved || p.distanceTo(drag.position) > 0.02;
      dirty = true;
    }
  }
  function up(e?: PointerEvent) {
    if (discoveryMode) {
      dirty = true;
      return;
    }
    if (gesture) {
      if (e) touches.delete(e.pointerId);
      else touches.clear();
      const previous = gesture;
      if (!touches.size) {
        gesture = null;
        if (e?.type === "pointerup" && !previous.moved) {
          const hit = pick(e);
          if (hit?.object.userData.edge)
            options.select(hit.object.userData.edge, true);
          else options.select(previous.id || "");
        }
      }
      dirty = true;
      return;
    }
    if (!drag) return;
    const d = drag;
    drag = null;
    const g = models.get(d.id);
    if (d.moved && g) options.move(d.id, { ...g.userData.base });
    dirty = true;
  }
  function wheel(e: WheelEvent) {
    if (discoveryMode) {
      dirty = true;
      return;
    }
    e.preventDefault();
    cancelTravel();
    targetZoom = T.MathUtils.clamp(
      targetZoom * Math.exp(-e.deltaY * 0.0015),
      0.6,
      2,
    );
    dirty = true;
  }
  function leave() {
    hovered = null;
    dirty = true;
  }
  function resize() {
    const r = host.getBoundingClientRect();
    const aspect = r.width / Math.max(1, r.height);
    const halfY = Math.max(fitY, fitX / aspect) / zoom;
    camera.left = -halfY * aspect;
    camera.right = halfY * aspect;
    camera.top = halfY;
    camera.bottom = -halfY;
    camera.updateProjectionMatrix();
    renderer.setSize(r.width, r.height, false);
    cosmos.resize(r.width, r.height);
    atmosphere.update(reduced ? 0 : last / 1000, reduced, camera);
    renderer.render(scene, viewCamera());
    publishAnchors();
    dirty = true;
  }
  function contextLost(e: Event) {
    e.preventDefault();
    cancelAnimationFrame(frame);
    options.fail();
  }
  renderer.domElement.addEventListener("wheel", wheel, { passive: false });
  renderer.domElement.addEventListener("pointerleave", leave);
  renderer.domElement.addEventListener("pointerdown", down);
  renderer.domElement.addEventListener("pointermove", move);
  renderer.domElement.addEventListener("pointerup", up);
  renderer.domElement.addEventListener("pointercancel", up);
  renderer.domElement.addEventListener("lostpointercapture", up);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const curvePoint = new T.Vector3();
  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    if (
      disposed ||
      document.hidden ||
      (!dirty &&
        reduced &&
        !flying &&
        !cosmos.moving &&
        Math.abs(targetZoom - zoom) < 0.001)
    )
      return;
    if (now - last < 1000 / (innerWidth < 700 ? 24 : 30)) return;
    last = now;
    const t = reduced ? 0 : now / 1000;
    if (flying) {
      const amount = reduced ? 1 : 0.16;
      camera.position.x += (travel.x - camera.position.x) * amount;
      camera.position.y += (travel.y - camera.position.y) * amount;
      if (
        Math.hypot(travel.x - camera.position.x, travel.y - camera.position.y) <
        0.01
      ) {
        camera.position.x = travel.x;
        camera.position.y = travel.y;
        flying = false;
      }
      dirty = true;
    }
    if (Math.abs(targetZoom - zoom) > 0.001) {
      zoom = reduced ? targetZoom : zoom + (targetZoom - zoom) * 0.18;
      resize();
      dirty = true;
    }
    atmosphere.update(t, reduced, camera);
    cosmos.update(now, reduced);
    renderer.domElement.dataset.camera = [
      camera.position.x.toFixed(3),
      camera.position.y.toFixed(3),
      zoom.toFixed(3),
    ].join(",");
    renderer.domElement.dataset.hovered = hovered || "";
    renderer.domElement.dataset.scenery = atmosphere.sceneryState;
    for (const [id, g] of models) {
      const rotation = graph.characters.find((c) => c.id === id)?.appearance
        .rotation;
      g.rotation.x = T.MathUtils.degToRad(rotation?.x ?? 0);
      g.rotation.z = T.MathUtils.degToRad(rotation?.z ?? 0);
      g.rotation.y = T.MathUtils.degToRad(rotation?.y ?? 0);
      if (drag?.id !== id) {
        g.position.y =
          g.userData.base.y +
          Math.sin(t * (speeds[g.userData.type] || 1) + g.userData.base.x) *
            0.09;
        g.rotation.y += reduced
          ? 0
          : Math.sin(t * 0.4 + g.userData.base.x) * 0.16;
      }
      if (id === selected)
        renderer.domElement.dataset.selectedRotation = [
          g.rotation.x,
          g.rotation.y,
          g.rotation.z,
        ]
          .map((n) => n.toFixed(4))
          .join(",");
      g.getObjectByName("selection-halo")!.visible =
        id === selected || id === hovered;
      const aura = g.getObjectByName("image-aura") as T.Mesh | undefined;
      if (aura) (aura.material as T.MeshBasicMaterial).opacity = 0;
      const portalEnergy = g.getObjectByName("portal-energy") as
        T.Mesh | undefined;
      if (portalEnergy) {
        portalEnergy.rotation.z = reduced ? 0 : t * 0.18;
        portalEnergy.scale.setScalar(
          reduced ? 1 : 1 + Math.sin(t * 0.9) * 0.025,
        );
        (portalEnergy.material as T.MeshBasicMaterial).opacity = reduced
          ? 0.28
          : 0.32 + Math.sin(t * 0.9) * 0.1;
      }
      const sparks = g.getObjectByName("image-sparks");
      if (sparks)
        sparks.rotation.z = reduced
          ? 0
          : t * (g.userData.type === "collector" ? 0.18 : -0.08);
    }
    for (const e of graph.connections) {
      const l = links.get(e.id),
        a = models.get(e.sourceCharacterId),
        b = models.get(e.targetCharacterId);
      if (!l || !a || !b) continue;
      if (drag || !reduced) {
        l.curve.points[0].copy(a.position);
        l.curve.points[2].copy(b.position);
        l.curve.points[1].copy(a.position).add(b.position).multiplyScalar(0.5);
        l.curve.points[1].y += Math.min(
          1.6,
          a.position.distanceTo(b.position) * 0.18,
        );
        l.curve.points[1].z += 0.35;
        const buffer = l.line.geometry.attributes.position as T.BufferAttribute;
        for (let i = 0; i <= 40; i++) {
          l.curve.getPoint(i / 40, curvePoint);
          buffer.setXYZ(i, curvePoint.x, curvePoint.y, curvePoint.z);
        }
        buffer.needsUpdate = true;
        l.line.geometry.computeBoundingSphere();
      }
      l.curve.getPoint((t * 0.18) % 1, l.bead.position);
    }
    publishAnchors();
    renderer.render(scene, viewCamera());
    dirty = false;
  }
  frame = requestAnimationFrame(tick);
  return {
    stop() {
      cancelTravel();
      dirty = true;
    },
    focus(id: string) {
      const g = models.get(id);
      if (g) {
        if (discoveryMode) {
          cosmos.focus(g.position);
          dirty = true;
          return;
        }
        travel.set(g.userData.base.x, g.userData.base.y);
        flying = true;
        dirty = true;
      }
    },
    reset() {
      cosmos.reset();
      cancelTravel();
      targetZoom = zoom = 1;
      camera.position.set(0, 0, 35);
      if (graph.characters.length) {
        const xs = graph.characters.map((c) => c.position.x),
          ys = graph.characters.map((c) => c.position.y);
        camera.position.x = (Math.max(...xs) + Math.min(...xs)) / 2;
        camera.position.y = (Math.max(...ys) + Math.min(...ys)) / 2;
      }
      zoom = 1;
      resize();
    },
    update(next: SpiritGraph) {
      build(next);
    },
    select(id: string | null, edge: string | null) {
      selected = id;
      edgeSelected = edge;
      for (const [eid, l] of links)
        (l.line.material as T.LineBasicMaterial).color.set(
          eid === edge ? "#ffe5a2" : "#7ed2ef",
        );
      dirty = true;
    },
    mode(r: boolean, x: boolean, discovery = false) {
      reduced = r;
      explore = x;
      discoveryMode = discovery;
      atmosphere.mode(!discovery);
      cosmos.mode(discovery);
      resize();
      gesture = null;
      touches.clear();
      cancelTravel();
      dirty = true;
    },
    getZoom() {
      return targetZoom;
    },
    zoom(value: number) {
      targetZoom = value;
      dirty = true;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", up);
      renderer.domElement.removeEventListener("lostpointercapture", up);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.domElement.removeEventListener("wheel", wheel);
      renderer.domElement.removeEventListener("pointerleave", leave);
      cosmos.dispose();
      atmosphere.dispose();
      clean(scene);
      uploadTemplates.forEach((object) => disposeAsset(object));
      uploadTemplates.clear();
      textures.forEach((texture) => texture.dispose());
      textures.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
