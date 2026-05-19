import { useRef } from "react";
import { Box, Center, Text } from "@mantine/core";

interface GifPreviewProps {
  src: string | null;
  label?: string;
  maxHeight?: number;
  eyedropperActive?: boolean;
  onColorPicked?: (hex: string) => void;
}

export function GifPreview({
  src,
  label,
  maxHeight = 300,
  eyedropperActive = false,
  onColorPicked,
}: GifPreviewProps) {
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
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    onColorPicked(hex);
  }

  return (
    <Box
      style={{
        width: "100%",
        minHeight: 160,
        background: "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 16px 16px",
        border: eyedropperActive
          ? "2px solid var(--mantine-color-blue-5)"
          : "1px solid var(--mantine-color-gray-3)",
        borderRadius: "var(--mantine-radius-md)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {src ? (
        <img
          ref={imgRef}
          src={src}
          alt={label ?? "GIF preview"}
          onClick={handleClick}
          style={{
            maxWidth: "100%",
            maxHeight,
            objectFit: "contain",
            display: "block",
            cursor: eyedropperActive ? "crosshair" : "default",
          }}
        />
      ) : (
        <Center style={{ height: "100%", minHeight: 160 }}>
          <Text c="dimmed" size="sm">
            {label ?? "No GIF loaded"}
          </Text>
        </Center>
      )}
    </Box>
  );
}
