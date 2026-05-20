export function hexToRgb(hex: string) {
  const c = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 };
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from({ length: bin.length }, (_, i) => bin.charCodeAt(i));
}

export type ProgressEvent =
  | { type: "decode" }
  | { type: "transform"; frame: number; total: number }
  | { type: "encode"; frame: number; total: number };
