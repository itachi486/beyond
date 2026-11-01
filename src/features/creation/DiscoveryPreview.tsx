import { useEffect, useState } from "react";
import { getAsset, type ImportedAsset } from "./uploadAssets";
import AssetPreview from "./AssetPreview";
export default function DiscoveryPreview({
  id,
  es,
}: {
  id: string;
  es: boolean;
}) {
  const [asset, setAsset] = useState<ImportedAsset | null>(null),
    [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true;
    setAsset(null);
    setMissing(false);
    getAsset(id)
      .then((a) => {
        if (live) {
          setAsset(a || null);
          setMissing(!a);
        }
      })
      .catch(() => {
        if (live) setMissing(true);
      });
    return () => {
      live = false;
    };
  }, [id]);
  return asset ? (
    <AssetPreview asset={asset} es={es} onReady={() => {}} />
  ) : (
    <p role="status">
      {missing
        ? es
          ? "Archivo no disponible en este navegador. El mundo se conserva."
          : "File unavailable in this browser. Your world is preserved."
        : es
          ? "Cargando vista previa…"
          : "Loading preview…"}
    </p>
  );
}
