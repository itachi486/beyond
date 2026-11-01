import * as T from "three";
// UI-cleaned reference artwork, shared across three depth planes. No invented records.
export function hybridScenery(
  scene: T.Scene,
  onError?: () => void,
  onReady?: () => void,
) {
  const group = new T.Group();
  group.visible = false;
  scene.add(group);
  let disposed = false,
    ready = false,
    enabled = false;
  const texture = new T.TextureLoader().load(
    "/infinite-cosmos-clean.webp",
    () => {
      if (disposed) {
        texture.dispose();
        return;
      }
      ready = true;
      group.visible = enabled;
      onReady?.();
    },
    undefined,
    () => {
      if (!disposed) onError?.();
    },
  );
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 1;
  const geometry = new T.PlaneGeometry(1, 1);
  const vertexShader =
    "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
  const fragmentShader = `uniform sampler2D artwork; uniform vec4 crop; uniform float feather; uniform float brightness; uniform float opacity; varying vec2 vUv;
 void main(){vec2 uv=crop.xy+vUv*crop.zw;vec4 pixel=texture2D(artwork,uv);float edge=1.;if(feather>0.)edge=smoothstep(0.,feather,vUv.x)*smoothstep(0.,feather,1.-vUv.x)*smoothstep(0.,feather,vUv.y)*smoothstep(0.,feather,1.-vUv.y);gl_FragColor=vec4(pixel.rgb*brightness,pixel.a*opacity*edge);
 #include <colorspace_fragment>
 }`;
  const materials: T.ShaderMaterial[] = [];
  function plane(
    crop: number[],
    feather: number,
    brightness: number,
    opacity: number,
    z: number,
  ) {
    const material = new T.ShaderMaterial({
      uniforms: {
        artwork: { value: texture },
        crop: { value: new T.Vector4(...crop) },
        feather: { value: feather },
        brightness: { value: brightness },
        opacity: { value: opacity },
      },
      vertexShader,
      fragmentShader,
      transparent: feather > 0,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    materials.push(material);
    const object = new T.Mesh(geometry, material);
    object.position.z = z;
    object.renderOrder = -100 + materials.length;
    object.frustumCulled = false;
    group.add(object);
    return object;
  }
  const background = plane([0, 0, 1, 1], 0, 1, 1, -48);
  const left = plane([0, 0.05, 0.31, 0.88], 0.18, 1, 1, -30),
    right = plane([0.65, 0.06, 0.35, 0.88], 0.18, 1, 1, -24);
  // An energy overlay follows the portal in the painting. It is decoration, not a new destination.
  const ringGeometry = new T.TorusGeometry(1, 0.009, 5, 96),
    ringMaterial = new T.MeshBasicMaterial({
      color: "#b8cfff",
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
  const ring = new T.Mesh(ringGeometry, ringMaterial);
  ring.renderOrder = -90;
  group.add(ring);
  const motesGeometry = new T.BufferGeometry();
  const positions = new Float32Array(64 * 3);
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2,
      radius = 1 + (i % 5) * 0.025;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius;
  }
  motesGeometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  const motesMaterial = new T.PointsMaterial({
    color: "#d5bdff",
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  const motes = new T.Points(motesGeometry, motesMaterial);
  ring.add(motes);
  return {
    mode(value: boolean) {
      enabled = value;
      group.visible = value && ready;
    },
    get state() {
      return ready ? "ready" : "loading";
    },
    update(time: number, reduced: boolean, camera: T.OrthographicCamera) {
      if (!enabled) return;
      const w = camera.right - camera.left,
        h = camera.top - camera.bottom;
      // Cover without stretching; overscan and bounded camera parallax avoid exposed edges.
      const height = Math.max(h * 1.02, (w * 1.02) / (1672 / 941)),
        width = height * (1672 / 941);
      background.scale.set(width, height, 1);
      background.position.set(
        camera.position.x * 0.94,
        camera.position.y * 0.94,
        -48,
      );
      left.scale.set(width * 0.31, height * 0.88, 1);
      left.position.set(
        -width * 0.345 + camera.position.x * 0.935,
        height * -0.01 +
          camera.position.y * 0.935 +
          (reduced ? 0 : Math.sin(time * 0.09) * 0.018),
        -30,
      );
      right.scale.set(width * 0.35, height * 0.88, 1);
      right.position.set(
        width * 0.325 + camera.position.x * 0.925,
        height * 0.0 +
          camera.position.y * 0.925 +
          (reduced ? 0 : Math.sin(time * 0.075 + 2) * 0.023),
        -24,
      );
      ring.position.set(
        width * 0.1 + camera.position.x * 0.9,
        height * -0.165 + camera.position.y * 0.925,
        -19,
      );
      ring.scale.setScalar(height * 0.082);
      ring.rotation.z = reduced ? 0 : time * 0.09;
      motes.rotation.z = reduced ? 0 : time * -0.18;
      ringMaterial.opacity = reduced
        ? 0.16
        : 0.16 + Math.sin(time * 0.8) * 0.045;
    },
    dispose() {
      disposed = true;
      scene.remove(group);
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      motesGeometry.dispose();
      motesMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      texture.dispose();
    },
  };
}
