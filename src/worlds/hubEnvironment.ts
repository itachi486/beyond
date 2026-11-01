import * as T from "three";

/** Shared environmental kit: authored geometry, existing CC0 maps, bounded draw calls. */
export function createHubEnvironment(
  scene: T.Scene,
  simple: boolean,
  invalidate: () => void = () => {},
) {
  let disposed = false;
  const textures: T.Texture[] = [];
  const random = (n: number) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const stone = new T.MeshStandardMaterial({
    color: "#b0a897",
    roughness: 0.94,
    metalness: 0.04,
  });
  const rock = new T.MeshStandardMaterial({
    color: "#69747d",
    roughness: 1,
    vertexColors: true,
  });
  const trim = new T.MeshStandardMaterial({
    color: "#b09662",
    metalness: 0.58,
    roughness: 0.46,
    emissive: "#b5944c",
    emissiveIntensity: 0.15,
  });
  const loader = new T.TextureLoader();
  for (const [kind, file] of [
    ["map", "diff"],
    ["normalMap", "nor_gl"],
    ["roughnessMap", "rough"],
  ] as const) {
    if (simple && kind === "normalMap") continue;
    const neutral = new T.DataTexture(
      new Uint8Array(
        kind === "normalMap" ? [128, 128, 255, 255] : [255, 255, 255, 255],
      ),
      1,
      1,
    );
    neutral.colorSpace = kind === "map" ? T.SRGBColorSpace : T.NoColorSpace;
    neutral.needsUpdate = true;
    textures.push(neutral);
    for (const m of [stone, rock]) m[kind] = neutral;
    const t = loader.load(
      `/assets/hidden-worlds/mossy-rock-${file}-1k.jpg`,
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        loaded.wrapS = loaded.wrapT = T.RepeatWrapping;
        loaded.repeat.set(2, 2);
        loaded.colorSpace = kind === "map" ? T.SRGBColorSpace : T.NoColorSpace;
        for (const m of [stone, rock]) {
          m[kind] = loaded;
          m.needsUpdate = true;
        }
        invalidate();
      },
      undefined,
      () => {},
    );
    textures.push(t);
  }
  stone.normalScale.set(0.4, 0.4);
  rock.normalScale.set(0.8, 0.8);
  const cube = new T.BoxGeometry(1, 1, 1, 2, 2, 2);
  const p = cube.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      n = 0.97 + 0.03 * Math.sin(x * 21 + y * 17 + z * 13);
    p.setXYZ(i, x * n, y * n, z * n);
  }
  cube.computeVertexNormals();
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const c = shadowCanvas.getContext("2d");
  if (c) {
    const g = c.createRadialGradient(64, 64, 6, 64, 64, 64);
    g.addColorStop(0, "rgba(2,8,15,.8)");
    g.addColorStop(0.5, "rgba(2,8,15,.5)");
    g.addColorStop(1, "rgba(2,8,15,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }
  const shadowTexture = new T.CanvasTexture(shadowCanvas);
  textures.push(shadowTexture);
  const contact = new T.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });
  const dummy = new T.Object3D();
  function instances(
    parent: T.Object3D,
    mat: T.Material,
    transforms: T.Matrix4[],
  ) {
    if (!transforms.length) return;
    const mesh = new T.InstancedMesh(cube, mat, transforms.length);
    transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
    parent.add(mesh);
    return mesh;
  }
  function matrix(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    angle = 0,
  ) {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, angle, 0);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  }
  function island(
    x: number,
    z: number,
    size: number,
    parent: T.Object3D = scene,
    detail = true,
  ) {
    const group = new T.Group();
    group.name = "stratified-floating-island";
    group.position.set(x, 0, z);
    parent.add(group);
    const n = simple || !detail ? 28 : 48,
      levels = [1, 1.04, 0.9, 0.95, 0.69, 0.74, 0.43, 0.28, 0.025];
    const pos: number[] = [],
      uv: number[] = [],
      colors: number[] = [],
      idx: number[] = [];
    const phase = x * 0.1 + z * 0.2 + size;
    for (let j = 0; j < levels.length; j++)
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const edge =
          1 + Math.sin(a * 5 + phase) * 0.09 + Math.sin(a * 11 + phase) * 0.045;
        const r =
          size * levels[j] * edge * (1 + Math.sin(a * 9 + j * 2) * 0.055);
        const y =
          -0.35 -
          j * size * 0.23 +
          (j === 0 ? 0 : Math.sin(a * 7 + j) * size * 0.035);
        pos.push(
          Math.cos(a) * r + Math.sin(j) * size * 0.08,
          y,
          Math.sin(a) * r,
        );
        uv.push((i / n) * 3, j * 0.48);
        const shade = (j % 2 ? 0.62 : 0.88) * (1 - j * 0.035),
          v = 0.84 + random((i % n) + j) * 0.2;
        colors.push(shade * v, shade * v * 0.98, shade * v * 0.94);
        if (j < levels.length - 1 && i < n) {
          const k = j * (n + 1) + i;
          idx.push(k, k + 1, k + n + 1, k + 1, k + n + 2, k + n + 1);
        }
      }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    group.add(new T.Mesh(geo, rock));
    // Uneven apron around a stable, continuous walkable surface.
    const floorPos = [0, -0.34, 0],
      floorUV = [0.5, 0.5],
      floorIdx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2,
        r =
          size *
          (1 +
            Math.sin(a * 5 + phase) * 0.09 +
            Math.sin(a * 11 + phase) * 0.045);
      floorPos.push(Math.cos(a) * r, -0.34, Math.sin(a) * r);
      floorUV.push(0.5 + (Math.cos(a) * r) / 8, 0.5 + (Math.sin(a) * r) / 8);
      if (i < n) floorIdx.push(0, i + 2, i + 1);
    }
    const floor = new T.BufferGeometry();
    floor.setAttribute("position", new T.Float32BufferAttribute(floorPos, 3));
    floor.setAttribute("uv", new T.Float32BufferAttribute(floorUV, 2));
    floor.setIndex(floorIdx);
    floor.computeVertexNormals();
    group.add(new T.Mesh(floor, stone));
    if (detail) {
      const coping: T.Matrix4[] = [];
      for (let i = 0; i < (simple ? 22 : 34); i++) {
        const a = (i / (simple ? 22 : 34)) * Math.PI * 2,
          r =
            size *
            (1 +
              Math.sin(a * 5 + phase) * 0.09 +
              Math.sin(a * 11 + phase) * 0.045);
        coping.push(
          matrix(
            Math.cos(a) * r,
            -0.15,
            Math.sin(a) * r,
            0.65,
            0.3,
            ((Math.PI * 2 * size) / (simple ? 22 : 34)) * 1.05,
            -a,
          ),
        );
      }
      instances(group, stone, coping);
      const shadow = new T.Mesh(
        new T.PlaneGeometry(size * 1.7, size * 1.7),
        contact,
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -0.3;
      group.add(shadow);
    }
    return group;
  }
  function bridges(
    tiles: { position: T.Vector3; length: number; angle: number }[],
  ) {
    const decks: T.Matrix4[] = [],
      edges: T.Matrix4[] = [],
      posts: T.Matrix4[] = [],
      inlays: T.Matrix4[] = [],
      supports: T.Matrix4[] = [];
    tiles.forEach((t, i) => {
      const { x, z } = t.position,
        a = t.angle;
      // Existing walk paths continue across the terrace; raised bridge structure begins at its rim.
      if (Math.hypot(x, z - 11) < 12 && t.length < 5) return;
      decks.push(matrix(x, -0.55, z, 3.25, 1.1, t.length + 0.1, a));
      for (const side of [-1, 1]) {
        const ex = x + Math.cos(a) * 1.53 * side,
          ez = z - Math.sin(a) * 1.53 * side;
        edges.push(matrix(ex, 0.08, ez, 0.24, 0.35, t.length + 0.12, a));
        if (i % 3 === 0) {
          posts.push(matrix(ex, 0.68, ez, 0.28, 1.1, 0.32, a));
          inlays.push(matrix(ex, 1.27, ez, 0.23, 0.1, 0.23, a));
        }
      }
      if (i % 5 === 0) {
        supports.push(matrix(x, -1.45, z, 3.7, 0.4, 0.5, a));
        for (const side of [-1, 1])
          supports.push(
            matrix(
              x + Math.cos(a) * side,
              -1.15,
              z - Math.sin(a) * side,
              0.32,
              1.6,
              0.6,
              a,
            ),
          );
      }
      if (i % 2 === 0)
        inlays.push(matrix(x, 0.025, z, 0.08, 0.025, t.length * 0.55, a));
    });
    instances(scene, stone, decks);
    instances(scene, stone, edges);
    instances(scene, stone, posts);
    instances(scene, rock, supports);
    instances(scene, trim, inlays);
  }
  function compass() {
    const slabs: T.Matrix4[] = [];
    for (const radius of [4, 7, 10]) {
      const count = Math.round(radius * 5);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        slabs.push(
          matrix(
            Math.cos(a) * radius,
            -0.25,
            11 + Math.sin(a) * radius,
            0.7,
            0.14,
            ((Math.PI * 2 * radius) / count) * 0.91,
            -a,
          ),
        );
      }
    }
    instances(scene, stone, slabs);
    const shape = new T.Shape();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2,
        r = i % 2 ? 0.75 : i % 4 ? 2.5 : 3.5;
      const x = Math.sin(a) * r,
        y = Math.cos(a) * r;
      i ? shape.lineTo(x, y) : shape.moveTo(x, y);
    }
    shape.closePath();
    const rose = new T.Mesh(new T.ShapeGeometry(shape), trim);
    rose.rotation.x = -Math.PI / 2;
    rose.position.set(0, -0.13, 11);
    scene.add(rose);
  }
  // Layered star/nebula sky: procedural shading, not a flattened reference backdrop.
  // Bake tileable cloud noise once on the CPU; avoid per-pixel multi-octave sine noise.
  const noiseBytes = new Uint8Array(256 * 128 * 4);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 256; x++) {
      const a = (x / 256) * Math.PI * 2,
        b = (y / 128) * Math.PI * 2;
      const value = Math.round(
        (0.5 +
          Math.sin(a * 3 + Math.sin(b * 2)) *
            Math.sin(b * 2 + Math.cos(a * 2)) *
            0.25 +
          Math.sin(a * 7 + b * 5) * 0.08) *
          255,
      );
      const i = (y * 256 + x) * 4;
      noiseBytes[i] = noiseBytes[i + 1] = noiseBytes[i + 2] = value;
      noiseBytes[i + 3] = 255;
    }
  const skyNoise = new T.DataTexture(noiseBytes, 256, 128);
  skyNoise.wrapS = skyNoise.wrapT = T.RepeatWrapping;
  skyNoise.magFilter = skyNoise.minFilter = T.LinearFilter;
  skyNoise.needsUpdate = true;
  textures.push(skyNoise);
  const skyTime = { value: 0 };
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms: { time: skyTime, skyNoise: { value: skyNoise } },
    vertexShader:
      "varying vec3 v;varying vec2 skyUv;void main(){v=normalize(position);skyUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
    varying vec3 v;varying vec2 skyUv;uniform float time;uniform sampler2D skyNoise;
    void main(){vec3 d=normalize(v);float n=texture2D(skyNoise,skyUv*vec2(3.,2.)+vec2(time*.0004,0.)).r*.7+texture2D(skyNoise,skyUv*vec2(7.,5.)+vec2(.3,.2)).r*.3;float ridge=exp(-pow((d.y-d.x*.35-.17)*3.7,2.));float clouds=smoothstep(.33,.7,n)*ridge;float horizon=exp(-pow((d.y+.035)*7.,2.));vec3 color=mix(vec3(.018,.035,.075),vec3(.07,.12,.22),max(0.,d.y));color+=clouds*vec3(.12,.14,.25)+horizon*vec3(.09,.13,.17);color+=pow(n,4.)*ridge*vec3(.12,.09,.17);gl_FragColor=vec4(color,1.);}
  `,
  });
  const sky = new T.Mesh(new T.SphereGeometry(220, 24, 16), skyMat);
  scene.add(sky);
  // Thin cloud banks separate cliff silhouettes; bounded layers scale down on mobile.
  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width = 256;
  cloudCanvas.height = 128;
  const ctx = cloudCanvas.getContext("2d");
  if (ctx) {
    for (let i = 0; i < 34; i++) {
      const x = random(i) * 256,
        y = 30 + random(i + 40) * 70,
        r = 25 + random(i + 80) * 35,
        g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(159,186,211,0.17)");
      g.addColorStop(1, "rgba(159,186,211,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 128);
    }
  }
  const cloudTex = new T.CanvasTexture(cloudCanvas);
  textures.push(cloudTex);
  const cloudMaterial = new T.MeshBasicMaterial({
    map: cloudTex,
    color: "#9db9cf",
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const clouds: T.Mesh[] = [];
  for (let i = 0; i < (simple ? 5 : 11); i++) {
    const cloud = new T.Mesh(new T.PlaneGeometry(70, 24), cloudMaterial);
    cloud.position.set(Math.sin(i * 2.4) * 42, -6 - (i % 3) * 3, -12 - i * 8);
    scene.add(cloud);
    clouds.push(cloud);
  }
  return {
    stone,
    rock,
    trim,
    island,
    bridges,
    compass,
    update(seconds: number, reduced: boolean) {
      if (reduced) return;
      skyTime.value = seconds;
      clouds.forEach(
        (m, i) =>
          (m.position.x =
            Math.sin(i * 2.4) * 42 + Math.sin(seconds * 0.025 + i) * 2),
      );
    },
    dispose() {
      disposed = true;
      textures.forEach((t) => t.dispose());
    },
  };
}
