import "./asset-preview.css";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { assetObject, disposeAsset, type ImportedAsset } from "./uploadAssets";
export default function AssetPreview({
  asset,
  onReady,
  es,
  transparent = false,
}: {
  asset: ImportedAsset;
  onReady: (ok: boolean) => void;
  es: boolean;
  transparent?: boolean;
}) {
  const [imageURL, setImageURL] = useState("");
  const host = useRef<HTMLDivElement>(null),
    ready = useRef(onReady),
    [error, setError] = useState(false);
  ready.current = onReady;
  useEffect(() => {
    let disposed = false,
      renderer: T.WebGLRenderer | undefined,
      object: T.Group | undefined,
      controls: OrbitControls | undefined,
      frame = 0;
    const element = host.current;
    if (asset.kind === "image") {
      const url = URL.createObjectURL(asset.file);
      setImageURL(url);
      ready.current(false);
      setError(false);
      return () => URL.revokeObjectURL(url);
    }
    setImageURL("");
    setError(false);
    ready.current(false);
    if (!element) return;
    const observer = new ResizeObserver(() => {
        if (renderer) {
          renderer.setSize(element.clientWidth, element.clientHeight, false);
          camera.aspect = element.clientWidth / element.clientHeight;
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        }
      }),
      scene = new T.Scene(),
      camera = new T.PerspectiveCamera(40, 1, 0.01, 100);
    camera.position.set(0, 0, 6);
    scene.background = transparent ? null : new T.Color("#101a30");
    scene.add(new T.HemisphereLight("#e4edff", "#38405a", 3));
    const light = new T.DirectionalLight("#fff1dd", 4);
    light.position.set(3, 4, 5);
    scene.add(light);
    void assetObject(asset)
      .then((g) => {
        if (disposed) {
          disposeAsset(g);
          return;
        }
        object = g;
        scene.add(g);
        try {
          renderer = new T.WebGLRenderer({
            antialias: true,
            alpha: transparent,
            powerPreference: "low-power",
          });
          renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
          renderer.setSize(element.clientWidth, element.clientHeight, false);
          renderer.outputColorSpace = T.SRGBColorSpace;
          renderer.toneMapping = T.ACESFilmicToneMapping;
          element.appendChild(renderer.domElement);
          camera.aspect = element.clientWidth / element.clientHeight;
          camera.updateProjectionMatrix();
          controls = new OrbitControls(camera, renderer.domElement);
          controls.enablePan = false;
          controls.minDistance = 2;
          controls.maxDistance = 12;
          controls.addEventListener("change", () =>
            renderer?.render(scene, camera),
          );
          renderer.render(scene, camera);
          observer.observe(element);
          ready.current(true);
        } catch {
          setError(true);
          ready.current(false);
        }
      })
      .catch(() => {
        if (!disposed) {
          setError(true);
          ready.current(false);
        }
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls?.dispose();
      if (object) disposeAsset(object);
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
  }, [asset.id, asset.file, transparent]);
  return (
    <div className="upload-preview" ref={host}>
      {imageURL && (
        <img
          src={imageURL}
          alt={asset.name}
          onLoad={() => ready.current(true)}
          onError={() => {
            setError(true);
            ready.current(false);
          }}
        />
      )}
      {error && (
        <p role="alert">
          {es
            ? "No se pudo cargar o mostrar el archivo."
            : "File could not be loaded or rendered."}
        </p>
      )}
    </div>
  );
}
