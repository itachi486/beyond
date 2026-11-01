import * as T from "three";

/** One authored environment prototype. Positions are local to the persisted hub world. */
export function createHiddenWorlds(
  parent: T.Group,
  simple: boolean,
  invalidate: () => void = () => {},
) {
  const root = new T.Group();
  root.name = "hidden-worlds-garden";
  parent.add(root);
  let disposed = false;
  const ownedTextures: T.Texture[] = [];
  const time = { value: 0 };
  const random = (n: number) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const stone = new T.MeshStandardMaterial({
    color: "#b0b6a0",
    roughness: 0.95,
  });
  const cliff = stone.clone();
  cliff.color.set("#677e76");
  const earth = new T.MeshStandardMaterial({ color: "#293e30", roughness: 1 });
  const bark = new T.MeshStandardMaterial({ color: "#424638", roughness: 1 });
  const moss = new T.MeshStandardMaterial({ color: "#5d7840", roughness: 1 });
  const loader = new T.TextureLoader();
  // Geometry and base colors are useful immediately; missing maps never block exploration.
  const mapStates: Record<string, string> = {};
  root.userData.textureState = mapStates;
  function map(file: string, key: "map" | "normalMap" | "roughnessMap") {
    mapStates[key] = "loading";
    // Neutral maps keep the shader feature set stable during asynchronous loading.
    // This avoids repeated compilation and retains base materials on network failure.
    const pixel =
      key === "normalMap" ? [128, 128, 255, 255] : [255, 255, 255, 255];
    const neutral = new T.DataTexture(new Uint8Array(pixel), 1, 1);
    neutral.colorSpace = key === "map" ? T.SRGBColorSpace : T.NoColorSpace;
    neutral.needsUpdate = true;
    ownedTextures.push(neutral);
    for (const material of [stone, cliff]) material[key] = neutral;
    const texture = loader.load(
      `/assets/hidden-worlds/${file}`,
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        loaded.wrapS = loaded.wrapT = T.RepeatWrapping;
        loaded.repeat.set(1.5, 1.5);
        loaded.colorSpace = key === "map" ? T.SRGBColorSpace : T.NoColorSpace;
        for (const m of [stone, cliff]) {
          m[key] = loaded;
          m.needsUpdate = true;
        }
        mapStates[key] = "ready";
        invalidate();
      },
      undefined,
      () => {
        mapStates[key] = "unavailable";
      },
    );
    ownedTextures.push(texture);
  }
  map("mossy-rock-diff-1k.jpg", "map");
  if (!simple) map("mossy-rock-nor_gl-1k.jpg", "normalMap");
  map("mossy-rock-rough-1k.jpg", "roughnessMap");
  stone.normalScale.set(0.6, 0.6);
  cliff.normalScale.set(1, 1);

  function add(
    geometry: T.BufferGeometry,
    material: T.Material,
    x = 0,
    y = 0,
    z = 0,
    scale?: number[],
  ) {
    const m = new T.Mesh(geometry, material);
    m.position.set(x, y, z);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    root.add(m);
    return m;
  }
  // Stratified eroded cliff, rather than a smooth inverted cone.
  const count = simple ? 22 : 38,
    layers = 7,
    vertices: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let j = 0; j < layers; j++)
    for (let i = 0; i <= count; i++) {
      const a = (i / count) * Math.PI * 2;
      const h = j / (layers - 1);
      const radius =
        (8 - h * 5.4) * (0.86 + random((i % count) * 3 + j * 0.2) * 0.28);
      vertices.push(
        Math.cos(a) * radius,
        -0.7 - h * 15 + Math.sin(a * 5 + j) * 0.4,
        Math.sin(a) * radius * 0.8 - 0.5,
      );
      uvs.push((i / count) * 3, h * 3);
      if (j < layers - 1 && i < count) {
        const n = j * (count + 1) + i;
        indices.push(
          n,
          n + 1,
          n + count + 1,
          n + 1,
          n + count + 2,
          n + count + 1,
        );
      }
    }
  const terrain = new T.BufferGeometry();
  terrain.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  terrain.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  terrain.setIndex(indices);
  terrain.computeVertexNormals();
  add(terrain, cliff);
  add(
    new T.CylinderGeometry(7.9, 7.2, 0.65, 38),
    earth,
    0,
    -0.65,
    -0.5,
    [1, 1, 0.82],
  );
  // Individual weathered stone pieces share a single geometry/material and draw call.
  const block = new T.BoxGeometry(1, 1, 1, 2, 2, 2);
  const bp = block.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i),
      y = bp.getY(i),
      z = bp.getZ(i);
    const n = 0.94 + 0.06 * Math.sin(x * 17 + y * 11 + z * 29);
    bp.setXYZ(i, x * n, y * n, z * n);
  }
  block.computeVertexNormals();
  const stones: T.Matrix4[] = [];
  const dummy = new T.Object3D();
  function blockAt(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    ry = 0,
  ) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    stones.push(dummy.matrix.clone());
  }
  // Approach stairs, a framed ceremonial threshold and two stepped garden terraces.
  for (let step = 0; step < 7; step++)
    blockAt(0, 0.05 + step * 0.1, 4.9 - step * 0.52, 3.1, 0.22, 0.58);
  for (const x of [-4.2, 4.2])
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 5; i++)
        blockAt(
          x + (i % 2) * 0.15,
          row * 0.48,
          -2.5 + i * 1.1,
          1.2,
          0.52,
          1,
          random(i + row) * 0.1,
        );
  for (const x of [-2.6, 2.6])
    for (let j = 0; j < 7; j++)
      blockAt(
        x,
        0.75 + j * 0.85,
        -0.9,
        1.14 + (j === 0 ? 0.25 : 0),
        0.79,
        1.45,
        Math.sin(j * 7) * 0.025,
      );
  // True wedge-shaped voussoirs forming the arch, not a glowing torus substitute.
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI,
      b = ((i + 0.94) / 13) * Math.PI;
    const shape = new T.Shape();
    shape.moveTo(Math.cos(a) * 2.05, Math.sin(a) * 2.9);
    shape.lineTo(Math.cos(a) * 3.18, Math.sin(a) * 3.7);
    shape.lineTo(Math.cos(b) * 3.18, Math.sin(b) * 3.7);
    shape.lineTo(Math.cos(b) * 2.05, Math.sin(b) * 2.9);
    shape.closePath();
    add(
      new T.ExtrudeGeometry(shape, {
        depth: 1.45,
        bevelEnabled: true,
        bevelSize: 0.06,
        bevelThickness: 0.06,
        bevelSegments: 1,
        steps: 1,
      }),
      stone,
      0,
      6.25,
      -1.62,
    );
  }
  // Broken rear garden walls frame the gateway instead of leaving trees on an empty pad.
  for (const side of [-1, 1])
    for (let row = 0; row < 4; row++)
      for (let i = 0; i < 4 - Math.floor(row / 2); i++)
        blockAt(
          side * (3.5 + i * 0.9),
          0.4 + row * 0.7,
          -3.6,
          0.85,
          0.65,
          0.8,
          side * 0.08,
        );
  // Ground tiles lead into the garden; irregular edges leave soil and moss seams.
  for (let i = 0; i < (simple ? 36 : 70); i++) {
    const a = random(i + 8) * Math.PI * 2,
      r = 2 + random(i + 900) * 4;
    blockAt(
      Math.cos(a) * r,
      -0.13,
      Math.sin(a) * r * 0.8,
      0.55 + random(i) * 0.4,
      0.13,
      0.65,
      random(i + 3),
    );
  }
  const masonry = new T.InstancedMesh(block, stone, stones.length);
  stones.forEach((matrix, i) => masonry.setMatrixAt(i, matrix));
  root.add(masonry);
  // Basalt buttresses, ledges and moss islands provide silhouette detail at every distance.
  const rockGeo = new T.IcosahedronGeometry(1, 1);
  const rp = rockGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i),
      y = rp.getY(i),
      z = rp.getZ(i),
      n = 1 + 0.2 * Math.sin(x * 9 + y * 4 + z * 7);
    rp.setXYZ(i, x * n, y * n, z * n);
  }
  rockGeo.computeVertexNormals();
  const rocks = new T.InstancedMesh(rockGeo, cliff, simple ? 22 : 42);
  for (let i = 0; i < rocks.count; i++) {
    const a = i * 2.399,
      r = 6.4 + random(i) * 1.4;
    dummy.position.set(
      Math.cos(a) * r,
      -1 - random(i + 8) * 8,
      Math.sin(a) * r * 0.8,
    );
    dummy.rotation.set(random(i) * 2, random(i + 1) * 6, random(i + 2));
    dummy.scale.set(0.8 + random(i) * 1.8, 1 + random(i + 4) * 2, 1.1);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  root.add(rocks);
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4;
    add(
      rockGeo,
      moss,
      Math.sin(a) * 6.6,
      0.05,
      Math.cos(a) * 5.2,
      [0.8, 0.12, 0.6],
    );
  }

  // Hand-authored curved leaf surfaces, shared by trees, ferns and hanging vines.
  const leaf = new T.BufferGeometry();
  const lp: number[] = [],
    li: number[] = [],
    lc: number[] = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6,
      w = Math.sin(t * Math.PI) * 0.24;
    for (const side of [-1, 1]) {
      lp.push(side * w, t, Math.sin(t * Math.PI) * 0.15 + side * w * 0.15);
      lc.push(0.4 + t * 0.18, 0.62 + t * 0.16, 0.29 + t * 0.08);
    }
    if (i < 6) {
      const n = i * 2;
      li.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  leaf.setAttribute("position", new T.Float32BufferAttribute(lp, 3));
  leaf.setAttribute("color", new T.Float32BufferAttribute(lc, 3));
  leaf.setIndex(li);
  leaf.computeVertexNormals();
  const foliage = new T.MeshStandardMaterial({
    color: "#7f9b66",
    vertexColors: true,
    side: T.DoubleSide,
    roughness: 0.88,
  });
  foliage.onBeforeCompile = (shader) => {
    shader.uniforms.gardenTime = time;
    shader.vertexShader = "uniform float gardenTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n transformed.x += sin(gardenTime * 0.5 + position.y * 2.0) * position.y * 0.035;",
    );
  };
  foliage.customProgramCacheKey = () => "beyond-garden-foliage-v1";
  const leaves: T.Matrix4[] = [];
  function leafAt(
    x: number,
    y: number,
    z: number,
    scale: number,
    rx: number,
    ry: number,
    rz: number,
  ) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    leaves.push(dummy.matrix.clone());
  }
  function limb(points: T.Vector3[], radius: number) {
    return add(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points),
        simple ? 7 : 12,
        radius,
        5,
        false,
      ),
      bark,
    );
  }
  // Tall trees frame the opening; the central approach remains visually unobstructed.
  for (const [i, x, z] of [
    [0, -5.3, -1.9],
    [1, 5.1, -2.7],
    [2, -3.8, -4.5],
    [3, 4.5, 2.1],
  ]) {
    const height = i === 3 ? 5.5 : 9.3 + i * 0.55;
    const trunk = [
      new T.Vector3(x, 0, z),
      new T.Vector3(x + 0.4, height * 0.4, z - 0.3),
      new T.Vector3(x - 0.4, height * 0.75, z),
      new T.Vector3(x + 0.2, height, z - 0.7),
    ];
    limb(trunk, 0.24);
    for (let branch = 0; branch < (simple ? 4 : 7); branch++) {
      const a = branch * 2.4 + i,
        h = height * (0.6 + random(branch) * 0.3);
      const tip = new T.Vector3(
        x + Math.cos(a) * 2.5,
        h + 1,
        z + Math.sin(a) * 2,
      );
      limb(
        [
          new T.Vector3(x, h * 0.8, z),
          new T.Vector3((x + tip.x) / 2, h + 0.5, (z + tip.z) / 2),
          tip,
        ],
        0.07,
      );
      for (let j = 0; j < (simple ? 24 : 72); j++)
        leafAt(
          tip.x + (random(j + i * 40) - 0.5) * 2.4,
          tip.y + (random(j + 50) - 0.5) * 1.1,
          tip.z + (random(j + 66) - 0.5) * 2,
          0.32 + random(j) * 0.3,
          random(j) * 2,
          random(j + 1) * 6,
          random(j + 2) * 4,
        );
    }
    for (let j = 0; j < 4; j++) {
      const a = j * 1.6;
      limb(
        [
          new T.Vector3(x, 0.4, z),
          new T.Vector3(x + Math.sin(a) * 0.6, 0.05, z + Math.cos(a) * 0.6),
          new T.Vector3(x + Math.sin(a) * 1.9, 0, z + Math.cos(a) * 1.9),
        ],
        0.12,
      );
    }
  }
  // Compound fern fronds and trailing plants are genuine 3D leaves, not round tree placeholders.
  for (let i = 0; i < (simple ? 18 : 40); i++) {
    const a = i * 2.399,
      r = 3.5 + random(i) * 3.2,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r * 0.8;
    for (let frond = 0; frond < 5; frond++)
      for (let j = 0; j < 5; j++) {
        const angle = (frond * Math.PI * 2) / 5,
          t = j / 5;
        for (const side of [-1, 1])
          leafAt(
            x + Math.cos(angle) * t,
            z < -4 ? 1.3 : 0.2 + Math.sin(t * Math.PI) * 0.55,
            z + Math.sin(angle) * t,
            0.26 * (1 - t * 0.5),
            0.8,
            angle + side * 0.75,
            side * 0.75,
          );
      }
  }
  for (let strand = 0; strand < 11; strand++) {
    const x = -5.5 + strand * 1.1,
      y = 9.5 - Math.abs(x) * 0.35;
    for (let j = 0; j < 9; j++)
      leafAt(x + Math.sin(j) * 0.13, y - j * 0.32, -0.05, 0.32, 0.4, j, 0.7);
  }
  const plants = new T.InstancedMesh(leaf, foliage, leaves.length);
  plants.name = "layered-garden-vegetation";
  // Architecture remains pickable; avoid thousands of per-leaf ray intersections.
  plants.raycast = () => {};
  leaves.forEach((m, i) => plants.setMatrixAt(i, m));
  root.add(plants);

  // Flowing water and portal share a cheap time uniform, with no screen-space/postprocess pass.
  const shaderVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
  const water = new T.ShaderMaterial({
    uniforms: { time },
    vertexShader: shaderVertex,
    fragmentShader: `
    uniform float time; varying vec2 vUv;
    void main(){float edge=smoothstep(0.,.18,vUv.x)*smoothstep(0.,.18,1.-vUv.x);
      float streak=pow(.5+.5*sin(vUv.x*95.+sin(vUv.x*33.)*3.+vUv.y*7.-time*2.),5.);
      float fall=.5+.5*sin(vUv.y*48.+vUv.x*13.+time*4.);
      vec3 color=mix(vec3(.06,.25,.3),vec3(.72,.94,.91),streak*.75+fall*.15);
      gl_FragColor=vec4(color,edge*(.32+streak*.45)*smoothstep(0.,.06,vUv.y));}
  `,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
  });
  for (const x of [-4.4, 4.8]) {
    const sheet = new T.PlaneGeometry(x < 0 ? 1.6 : 0.8, 15, 6, 24);
    const surface = sheet.attributes.position;
    for (let i = 0; i < surface.count; i++)
      surface.setZ(
        i,
        Math.sin(surface.getX(i) * 7 + surface.getY(i) * 0.6) * 0.1,
      );
    sheet.computeVertexNormals();
    const curtain = add(sheet, water, x, -0.8, 2.1);
    curtain.rotation.y = x < 0 ? -0.15 : 0.2;
    // Water originates in an elevated channel, spills over the cliff into the mist.
    add(rockGeo, cliff, x, 6.5, 0.6, [1.6, 0.3, 1.4]);
    for (let level = 0; level < 3; level++)
      add(rockGeo, cliff, x, 1.6 + level * 1.8, -0.6, [1.3, 1.3, 1.5]);
  }
  const poolMaterial = new T.ShaderMaterial({
    uniforms: { time },
    vertexShader: shaderVertex,
    fragmentShader: `uniform float time;varying vec2 vUv;void main(){vec2 p=vUv-.5;float r=length(p);float ripple=.5+.25*sin(r*65.-time*1.8)+.25*sin((p.x+p.y)*42.+time*.8);float edge=1.-smoothstep(.38,.5,r);gl_FragColor=vec4(mix(vec3(.025,.12,.15),vec3(.26,.6,.58),ripple*.19),edge*.85);}`,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const pool = add(new T.CircleGeometry(2.8, 48), poolMaterial, 0, 0.05, 0.2);
  pool.rotation.x = -Math.PI / 2;
  const opening = new T.Shape();
  opening.moveTo(-1.9, 0);
  opening.lineTo(-1.9, 5.9);
  opening.quadraticCurveTo(-1.6, 8.5, 0, 9.1);
  opening.quadraticCurveTo(1.6, 8.5, 1.9, 5.9);
  opening.lineTo(1.9, 0);
  opening.closePath();
  const portal = new T.ShaderMaterial({
    uniforms: { time },
    vertexShader: shaderVertex,
    fragmentShader: `uniform float time;varying vec2 vUv;void main(){vec2 p=vec2(vUv.x/3.8,vUv.y/9.1);float shimmer=.5+.5*sin(p.y*9.-time*.35+sin(p.x*12.));float center=exp(-pow((vUv.x)/1.1,2.));gl_FragColor=vec4(mix(vec3(.015,.08,.1),vec3(.3,.78,.69),center*.65+shimmer*.05),.88);}`,
    transparent: true,
    side: T.DoubleSide,
  });
  add(new T.ShapeGeometry(opening, 20), portal, 0, 0.65, -0.82);
  for (const x of [-2.1, 2.1])
    add(
      new T.BoxGeometry(0.055, 5.8, 0.07),
      new T.MeshBasicMaterial({ color: "#b6e9ca" }),
      x,
      3.7,
      -0.05,
    );
  const portalLight = new T.PointLight("#78D9CC", 55, 17, 2);
  portalLight.position.set(0, 5.5, 1);
  root.add(portalLight);
  for (const x of [-3.3, 3.3]) {
    add(new T.CylinderGeometry(0.25, 0.35, 1.5, 7), stone, x, 0.7, 3.1);
    add(
      new T.SphereGeometry(0.17, 8, 6),
      new T.MeshBasicMaterial({ color: "#E6C58B" }),
      x,
      1.6,
      3.1,
    );
    const light = new T.PointLight("#E6C58B", 8, 5, 2);
    light.position.set(x, 1.8, 3.1);
    root.add(light);
  }
  // Soft, local mist and shafts: transparent geometry, not costly true volumetrics.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(175,212,210,0.35)");
    grad.addColorStop(1, "rgba(125,160,183,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const mistTexture = new T.CanvasTexture(canvas);
  ownedTextures.push(mistTexture);
  const mist = new T.MeshBasicMaterial({
    map: mistTexture,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const drifts: T.Mesh[] = [];
  for (let i = 0; i < (simple ? 3 : 7); i++) {
    const cloud = add(
      new T.PlaneGeometry(12, 5),
      mist,
      (random(i) - 0.5) * 9,
      -3 - i * 1.3,
      3 - i * 1.6,
    );
    cloud.rotation.z = (random(i) - 0.5) * 0.3;
    drifts.push(cloud);
  }
  const shaftMat = new T.MeshBasicMaterial({
    map: mistTexture,
    color: "#b8e6c2",
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
  });
  for (let i = 0; i < (simple ? 0 : 3); i++) {
    const shaft = add(
      new T.PlaneGeometry(1.7, 11),
      shaftMat,
      -2 + i * 2,
      6,
      -0.2,
    );
    shaft.rotation.z = -0.2;
  }
  const particles = new Float32Array((simple ? 24 : 80) * 3);
  for (let i = 0; i < particles.length; i += 3) {
    particles[i] = (random(i) - 0.5) * 12;
    particles[i + 1] = random(i + 1) * 10;
    particles[i + 2] = (random(i + 2) - 0.5) * 10;
  }
  const pg = new T.BufferGeometry();
  pg.setAttribute("position", new T.BufferAttribute(particles, 3));
  const pm = new T.PointsMaterial({
    color: "#d1e8ba",
    size: 0.055,
    transparent: true,
    opacity: 0.7,
    map: mistTexture,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  const dust = new T.Points(pg, pm);
  root.add(dust);
  root.userData.detail = {
    plants: leaves.length,
    stones: stones.length,
    externalMaps: simple ? 2 : 3,
  };
  return {
    update(seconds: number, reduced: boolean) {
      if (reduced) return;
      time.value = seconds;
      drifts.forEach((m, i) => {
        m.position.x = Math.sin(seconds * 0.07 + i) * 2;
      });
      dust.rotation.y = Math.sin(seconds * 0.045) * 0.08;
    },
    dispose() {
      disposed = true;
      ownedTextures.forEach((texture) => texture.dispose());
    },
  };
}
