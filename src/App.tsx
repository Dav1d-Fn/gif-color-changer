import { useState, useCallback, useEffect, useRef } from "react";
import {
  AppShell,
  Box,
  Button,
  Group,
  Loader,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { GifPreview } from "./components/GifPreview";
import { ColorEntryList, ColorEntry, RgbColor } from "./components/ColorEntryList";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "").slice(0, 6);
  const bigint = parseInt(clean, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let entryIdCounter = 0;
function newId() {
  return String(++entryIdCounter);
}

export default function App() {
  const [originalGifPath, setOriginalGifPath] = useState<string | null>(null);
  const [originalGifData, setOriginalGifData] = useState<string | null>(null);
  const [gifColors, setGifColors] = useState<RgbColor[]>([]);
  const [colorEntries, setColorEntries] = useState<ColorEntry[]>([]);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [pendingColor, setPendingColor] = useState("#ff0000");
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [gifTolerance, setGifTolerance] = useState(90);
  const [modifiedGifData, setModifiedGifData] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [gifLoading, setGifLoading] = useState(false);
  const [colorsLoading, setColorsLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [gifFrameCount, setGifFrameCount] = useState<number | null>(null);
  const [previewFrameIndex, setPreviewFrameIndex] = useState(0);
  const [previewModeActive, setPreviewModeActive] = useState(false);
  const [previewTrigger, setPreviewTrigger] = useState(0);
  const livePreviewEntriesRef = useRef<ColorEntry[] | null>(null);

  const isLoading = gifLoading || colorsLoading || applyLoading;

  const handleGifToleranceChange = useCallback(async (tol: number) => {
    setGifTolerance(tol);
    if (!originalGifPath) return;
    setColorsLoading(true);
    try {
      const colors = await invoke<RgbColor[]>("extract_gif_colors", {
        filePath: originalGifPath,
        tolerance: tol,
      });
      setGifColors(colors);
    } catch { /* silent */ }
    finally { setColorsLoading(false); }
  }, [originalGifPath]);

  async function handleOpenFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "GIF Files", extensions: ["gif"] }],
      });
      if (!selected) return;

      setGifLoading(true);
      const bytes = await readFile(selected);
      const base64 = btoa(Array.from(bytes).map((b) => String.fromCharCode(b)).join(""));

      setOriginalGifPath(selected);
      setOriginalGifData(`data:image/gif;base64,${base64}`);
      setModifiedGifData(null);
      setPreviewData(null);
      setGifFrameCount(null);
      setPreviewFrameIndex(0);
      setPreviewModeActive(false);
      setColorEntries([]);
      setAddPanelOpen(false);
      setEyedropperActive(false);

      const [colors, frameCount] = await Promise.all([
        invoke<RgbColor[]>("extract_gif_colors", { filePath: selected, tolerance: gifTolerance }),
        invoke<number>("get_gif_frame_count", { filePath: selected }),
      ]);
      setGifColors(colors);
      setGifFrameCount(frameCount);
    } catch (err) {
      notifications.show({ title: "Error opening file", message: String(err), color: "red" });
    } finally {
      setGifLoading(false);
    }
  }

  function handleColorPicked(hex: string) {
    setPendingColor(hex);
    setEyedropperActive(false);
  }

  function handleConfirmAdd(replHex: string, transparent: boolean, tolerance: number) {
    setColorEntries((prev) => [
      ...prev,
      { id: newId(), sourceHex: pendingColor, replHex, transparent, tolerance },
    ]);
    setAddPanelOpen(false);
    setEyedropperActive(false);
  }

  function handleToggleAddPanel() {
    setAddPanelOpen((v) => !v);
    setEyedropperActive(false);
  }

  function handleUpdateEntry(id: string, changes: Partial<Omit<ColorEntry, "id">>) {
    setColorEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...changes } : e))
    );
  }

  useEffect(() => {
    const entries = livePreviewEntriesRef.current ?? colorEntries;
    livePreviewEntriesRef.current = null;
    if (!previewModeActive || !originalGifPath || entries.length === 0) {
      setPreviewData(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const mappings = entries.map((e) => {
      const src = hexToRgb(e.sourceHex);
      const repl = e.transparent ? { r: 0, g: 0, b: 0 } : hexToRgb(e.replHex);
      return {
        targetR: src.r, targetG: src.g, targetB: src.b,
        replR: repl.r, replG: repl.g, replB: repl.b,
        transparent: e.transparent,
        tolerance: e.tolerance,
      };
    });
    invoke<string>("apply_frame", {
      filePath: originalGifPath,
      frameIndex: previewFrameIndex,
      mappings,
    })
      .then((result) => { if (!cancelled) setPreviewData(result); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  // previewTrigger forces re-run when live edits arrive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewModeActive, originalGifPath, colorEntries, previewFrameIndex, previewTrigger]);

  function handlePreviewUpdate(entries: ColorEntry[]) {
    livePreviewEntriesRef.current = entries;
    setPreviewTrigger((t) => t + 1);
  }

  async function handleApply() {
    if (!originalGifPath || colorEntries.length === 0) return;
    setApplyLoading(true);
    try {
      const mappings = colorEntries.map((e) => {
        const src = hexToRgb(e.sourceHex);
        const repl = e.transparent ? { r: 0, g: 0, b: 0 } : hexToRgb(e.replHex);
        return {
          targetR: src.r, targetG: src.g, targetB: src.b,
          replR: repl.r, replG: repl.g, replB: repl.b,
          transparent: e.transparent,
          tolerance: e.tolerance,
        };
      });

      const result = await invoke<string>("apply_color_changes", {
        filePath: originalGifPath,
        mappings,
      });
      setModifiedGifData(result);
    } catch (err) {
      notifications.show({ title: "Error applying changes", message: String(err), color: "red" });
    } finally {
      setApplyLoading(false);
    }
  }

  async function handleSave() {
    if (!modifiedGifData) return;
    try {
      const savePath = await save({
        filters: [{ name: "GIF Files", extensions: ["gif"] }],
        defaultPath: "modified.gif",
      });
      if (!savePath) return;

      const base64 = modifiedGifData.replace("data:image/gif;base64,", "");
      await writeFile(savePath, base64ToUint8Array(base64));
      notifications.show({ title: "Saved", message: `GIF saved to ${savePath}`, color: "green" });
    } catch (err) {
      notifications.show({ title: "Error saving file", message: String(err), color: "red" });
    }
  }

  return (
    <AppShell header={{ height: 56 }} padding="md">

      {/* Fullscreen loading overlay */}
      {isLoading && (
        <Box
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <Loader size="xl" color="white" />
        </Box>
      )}

      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>GIF Color Changer</Title>
          <Button onClick={handleOpenFile} variant="filled">Open GIF</Button>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Stack gap="md" maw={900} mx="auto">

          <Group grow align="flex-start" gap="md">
            <Stack gap={4}>
              <Group gap="xs" align="center">
                <Text size="sm" fw={600} c="dimmed">Original</Text>
                {eyedropperActive && (
                  <Text size="xs" c="blue">← click to pick color</Text>
                )}
              </Group>
              <GifPreview
                src={originalGifData}
                label="Open a GIF to preview it here"
                maxHeight={260}
                eyedropperActive={eyedropperActive}
                onColorPicked={handleColorPicked}
              />
            </Stack>
            <Stack gap={4}>
              <Text size="sm" fw={600} c="dimmed">Modified</Text>
              <Box style={{ position: "relative" }}>
                <GifPreview
                  src={previewData ?? modifiedGifData}
                  label="Apply changes to see result"
                  maxHeight={260}
                />
                {previewLoading && (
                  <Box style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", borderRadius: 8 }}>
                    <Loader size="sm" color="white" />
                  </Box>
                )}
              </Box>
              {originalGifData && (
                <Switch
                  size="sm"
                  label="Preview"
                  checked={previewModeActive}
                  onChange={(e) => setPreviewModeActive(e.currentTarget.checked)}
                />
              )}
              {previewData !== null && gifFrameCount !== null && gifFrameCount > 1 && (
                <Stack gap={2}>
                  <Text size="xs" c="dimmed">Frame {previewFrameIndex + 1} / {gifFrameCount}</Text>
                  <Slider
                    min={0}
                    max={gifFrameCount - 1}
                    step={1}
                    value={previewFrameIndex}
                    onChange={setPreviewFrameIndex}
                    onChangeEnd={setPreviewFrameIndex}
                    size="xs"
                    label={(v) => `${v + 1}`}
                  />
                </Stack>
              )}
            </Stack>
          </Group>

          {originalGifData && (
            <ColorEntryList
              entries={colorEntries}
              gifColors={gifColors}
              colorsLoading={colorsLoading}
              tolerance={gifTolerance}
              onToleranceChange={handleGifToleranceChange}
              onRemove={(id) => setColorEntries((prev) => prev.filter((e) => e.id !== id))}
              onUpdate={handleUpdateEntry}
              addPanelOpen={addPanelOpen}
              onToggleAddPanel={handleToggleAddPanel}
              pendingColor={pendingColor}
              onPendingColorChange={setPendingColor}
              onConfirmAdd={handleConfirmAdd}
              eyedropperActive={eyedropperActive}
              onToggleEyedropper={() => setEyedropperActive((v) => !v)}
              gifLoaded={!!originalGifData}
              previewModeActive={previewModeActive}
              onPreviewUpdate={handlePreviewUpdate}
            />
          )}

          {colorEntries.length > 0 && (
            <Button onClick={handleApply} loading={applyLoading} fullWidth>
              Apply Changes
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={!modifiedGifData}
            fullWidth
            variant="outline"
            color="green"
            size="md"
          >
            Save Modified GIF
          </Button>

          {originalGifPath && (
            <Group grow>
              <Button
                onClick={async () => {
                  const msg = await invoke<string>("debug_export_frames", { filePath: originalGifPath });
                  notifications.show({ title: "Debug frames exported", message: msg, color: "blue" });
                }}
                variant="subtle" color="gray" size="xs"
              >
                [Debug] Export decoded frames as PPM
              </Button>
              <Button
                onClick={async () => {
                  const result = await invoke<string>("debug_roundtrip", { filePath: originalGifPath });
                  setModifiedGifData(result);
                  notifications.show({ title: "Round-trip done", message: "Decode → re-encode (no transform) shown in Modified panel. Check console for color counts.", color: "blue" });
                }}
                variant="subtle" color="gray" size="xs"
              >
                [Debug] Round-trip (no transform)
              </Button>
            </Group>
          )}

        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
