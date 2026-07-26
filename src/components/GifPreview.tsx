import { useRef } from "react";
import { t } from "../i18n";

interface GifPreviewProps {
  src: string | null;
  label?: string;
  eyedropperActive?: boolean;
  onColorPicked?: (hex: string) => void;
}

export function GifPreview({ src, label, eyedropperActive = false, onColorPicked }: GifPreviewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function handleClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!eyedropperActive || !onColorPicked || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    const rect = img.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (img.naturalWidth / rect.width));
    const y = Math.floor((e.clientY - rect.top)  * (img.naturalHeight / rect.height));
    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
    onColorPicked(`#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`);
  }

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {src
        ? <img ref={imgRef} src={src} alt={label ?? t("gif_preview_alt")} onClick={handleClick} />
        : <span className="preview-placeholder">{label ?? t("no_gif_loaded")}</span>
      }
    </>
  );
}
