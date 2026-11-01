import { hybridScenery } from "./hybridScenery";
import * as T from "three";
// Decorative depth only: no discovery IDs, fake characters or persisted coordinates.
export function spiritAtmosphere(
  scene: T.Scene,
  onError?: () => void,
  onReady?: () => void,
) {
  const scenery = hybridScenery(scene, onError, onReady);
  const layers: T.Points[] = [];
  for (let layer = 0; layer < 3; layer++) {
    const count = innerWidth < 700 ? 280 : 800,
      positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (((i * 0.61803398875 + layer * 0.17) % 1) - 0.5) * 128;
      positions[i * 3 + 1] = (((i * 0.41421356 + layer * 0.31) % 1) - 0.5) * 96;
      positions[i * 3 + 2] = -10 - layer * 14 - (i % 9);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    const points = new T.Points(
      geometry,
      new T.PointsMaterial({
        color: ["#cee9ff", "#9d92e0", "#577da6"][layer],
        size: 2.2 - layer * 0.4,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    scene.add(points);
    layers.push(points);
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const clouds: T.Sprite[] = [];
  let texture: T.CanvasTexture | undefined;
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "#ffffffcc");
    gradient.addColorStop(0.4, "#ffffff50");
    gradient.addColorStop(1, "#ffffff00");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    texture = new T.CanvasTexture(canvas);
    for (let i = 0; i < 4; i++) {
      const cloud = new T.Sprite(
        new T.SpriteMaterial({
          map: texture,
          color: i % 2 ? "#345d9b" : "#60479a",
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        }),
      );
      cloud.position.set((i - 1.5) * 24, Math.sin(i * 3) * 10, -25 - i * 4);
      cloud.scale.set(50, 28, 1);
      scene.add(cloud);
      clouds.push(cloud);
    }
  }
  const planets: T.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const planet = new T.Mesh(
      new T.SphereGeometry(i ? 2.5 : 5, 24, 16),
      new T.MeshStandardMaterial({
        color: i ? "#536677" : "#394979",
        roughness: 0.88,
        metalness: 0.08,
      }),
    );
    planet.position.set(i ? 16 : -14, i ? -9 : 8, -40 - i * 4);
    scene.add(planet);
    planets.push(planet);
  }
  // A single reusable streak, infrequent and disabled under reduced motion.
  const streakGeometry = new T.BufferGeometry().setFromPoints([
    new T.Vector3(0, 0, 0),
    new T.Vector3(-1.8, 0.5, 0),
  ]);
  const streakMaterial = new T.LineBasicMaterial({
    color: "#c4eaff",
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const streak = new T.Line(streakGeometry, streakMaterial);
  streak.position.z = -8;
  scene.add(streak);
  return {
    mode(value: boolean) {
      scenery.mode(value);
      streak.visible = value;
      layers.forEach((p) => (p.visible = value));
      clouds.forEach((p) => (p.visible = value));
      planets.forEach((p) => {
        p.visible = false;
      });
    },
    get sceneryState() {
      return scenery.state;
    },
    update(time: number, reduced: boolean, camera: T.OrthographicCamera) {
      scenery.update(time, reduced, camera);
      const phase = time % 19;
      streakMaterial.opacity =
        !reduced && phase < 1.2 ? Math.sin((phase / 1.2) * Math.PI) * 0.65 : 0;
      streak.position.x = camera.position.x + (phase * 10 - 8);
      streak.position.y = camera.position.y + 8 - phase * 3;

      planets.forEach((p, i) => {
        p.position.x = (i ? 16 : -14) + camera.position.x * 0.65;
        p.position.y = (i ? -9 : 8) + camera.position.y * 0.65;
      });
      layers.forEach((p, i) => {
        p.position.x = camera.position.x * (0.18 + i * 0.2);
        p.position.y = camera.position.y * (0.18 + i * 0.2);
        p.rotation.z = reduced ? 0 : Math.sin(time * 0.018 + i) * 0.035;
        (p.material as T.PointsMaterial).opacity = reduced
          ? 0.55
          : 0.52 + Math.sin(time * (0.27 + i * 0.11) + i) * 0.12;
      });
      clouds.forEach((p, i) => {
        p.position.x =
          (i - 1.5) * 24 +
          camera.position.x * 0.6 +
          (reduced ? 0 : Math.sin(time * 0.025 + i) * 3);
        p.position.y = Math.sin(i * 3) * 10 + camera.position.y * 0.6;
      });
    },
    dispose() {
      scenery.dispose();
      scene.remove(streak);
      streakGeometry.dispose();
      streakMaterial.dispose();
      planets.forEach((p) => {
        scene.remove(p);
        p.geometry.dispose();
        (p.material as T.Material).dispose();
      });
      layers.forEach((p) => {
        scene.remove(p);
        p.geometry.dispose();
        (p.material as T.Material).dispose();
      });
      clouds.forEach((p) => {
        scene.remove(p);
        (p.material as T.Material).dispose();
      });
      texture?.dispose();
    },
  };
}
