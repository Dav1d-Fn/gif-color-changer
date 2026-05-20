import { useCallback, useEffect, useRef, useState } from "react";
import { Loader, Progress } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { invoke, Channel } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { GifPreview } from "./components/GifPreview";
import { ColorEntryList, ColorEntry, RgbColor } from "./components/ColorEntryList";
import { Toggle, RangeSlider } from "./components/ui";
import { t } from "./i18n";

function hexToRgb(hex: string) {
  const c = parseInt(hex.replace("#","").slice(0,6), 16);
  return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 };
}

function base64ToUint8Array(b64: string) {
  const bin = atob(b64);
  return Uint8Array.from({ length: bin.length }, (_, i) => bin.charCodeAt(i));
}

type ProgressEvent =
  | { type: "decode" }
  | { type: "transform"; frame: number; total: number }
  | { type: "encode"; frame: number; total: number };

let entryIdCounter = 0;
function newId() { return String(++entryIdCounter); }

const appWindow = getCurrentWindow();

export default function App() {
  const [originalGifPath,  setOriginalGifPath]  = useState<string | null>(null);
  const [originalGifData,  setOriginalGifData]  = useState<string | null>(null);
  const [gifColors,        setGifColors]        = useState<RgbColor[]>([]);
  const [colorEntries,     setColorEntries]     = useState<ColorEntry[]>([]);
  const [addPanelOpen,     setAddPanelOpen]     = useState(false);
  const [pendingColor,     setPendingColor]     = useState("#ff0000");
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [gifTolerance,     setGifTolerance]     = useState(90);
  const [modifiedGifData,  setModifiedGifData]  = useState<string | null>(null);
  const [previewData,      setPreviewData]      = useState<string | null>(null);
  const [gifLoading,       setGifLoading]       = useState(false);
  const [colorsLoading,    setColorsLoading]    = useState(false);
  const [applyLoading,     setApplyLoading]     = useState(false);
  const [applyProgress,    setApplyProgress]    = useState<{ current: number; total: number; phase: "transform" | "encode" } | null>(null);
  const [previewLoading,   setPreviewLoading]   = useState(false);
  const [gifFrameCount,    setGifFrameCount]    = useState<number | null>(null);
  const [previewFrameIndex, setPreviewFrameIndex] = useState(0);
  const [previewModeActive, setPreviewModeActive] = useState(false);
  const [previewTrigger,   setPreviewTrigger]   = useState(0);
  const liveEntriesRef = useRef<ColorEntry[] | null>(null);
  const [originalGifFilename, setOriginalGifFilename] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  // Track maximize state via window resize events
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    appWindow.isMaximized().then(setIsMaximized);
    appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    }).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  function handleTitlebarMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    appWindow.startDragging();
  }

  const isLoading = gifLoading || colorsLoading;
  const hasGif    = !!originalGifData;
  const hasFrames = gifFrameCount !== null && gifFrameCount > 1;

  // ── GIF tolerance ───────────────────────────────────────────────────────────
  const handleGifToleranceChange = useCallback(async (tol: number) => {
    setGifTolerance(tol);
    if (!originalGifPath) return;
    setColorsLoading(true);
    try {
      const colors = await invoke<RgbColor[]>("extract_gif_colors", { filePath: originalGifPath, tolerance: tol });
      setGifColors(colors);
    } catch { /* silent */ }
    finally { setColorsLoading(false); }
  }, [originalGifPath]);

  // ── Open file ───────────────────────────────────────────────────────────────
  async function handleOpenFile() {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "GIF Files", extensions: ["gif"] }] });
      if (!selected) return;
      setGifLoading(true);
      const bytes = await readFile(selected);
      const base64 = btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(""));
      setOriginalGifPath(selected);
      setOriginalGifData(`data:image/gif;base64,${base64}`);
      setOriginalGifFilename((selected as string).split(/[\\/]/).pop() ?? "file.gif");
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
      notifications.show({ title: t("err_open"), message: String(err), color: "red" });
    } finally { setGifLoading(false); }
  }

  // ── Color entry management ──────────────────────────────────────────────────
  function handleConfirmAdd(replHex: string, transparent: boolean, tolerance: number) {
    setColorEntries(prev => [...prev, { id: newId(), sourceHex: pendingColor, replHex, transparent, tolerance }]);
    setAddPanelOpen(false);
    setEyedropperActive(false);
  }

  function handleUpdateEntry(id: string, changes: Partial<Omit<ColorEntry, "id">>) {
    setColorEntries(prev => prev.map(e => e.id === id ? { ...e, ...changes } : e));
  }

  // ── Live preview effect ─────────────────────────────────────────────────────
  useEffect(() => {
    // liveEntriesRef persists across renders — only cleared explicitly (confirm/cancel)
    const entries = liveEntriesRef.current ?? colorEntries;
    if (!previewModeActive || !originalGifPath || entries.length === 0) {
      setPreviewData(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const mappings = entries.map(e => {
      const src  = hexToRgb(e.sourceHex);
      const repl = e.transparent ? { r: 0, g: 0, b: 0 } : hexToRgb(e.replHex);
      return { targetR: src.r, targetG: src.g, targetB: src.b, replR: repl.r, replG: repl.g, replB: repl.b, transparent: e.transparent, tolerance: e.tolerance };
    });
    invoke<string>("apply_frame", { filePath: originalGifPath, frameIndex: previewFrameIndex, mappings })
      .then(r  => { if (!cancelled) setPreviewData(r); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewModeActive, originalGifPath, colorEntries, previewFrameIndex, previewTrigger]);

  function handlePreviewUpdate(entries: ColorEntry[] | null) {
    liveEntriesRef.current = entries;
    setPreviewTrigger(t => t + 1);
  }

  // ── Apply ───────────────────────────────────────────────────────────────────
  async function handleApply() {
    if (!originalGifPath || colorEntries.length === 0) return;
    setApplyLoading(true);
    setApplyProgress(null);
    try {
      const mappings = colorEntries.map(e => {
        const src  = hexToRgb(e.sourceHex);
        const repl = e.transparent ? { r: 0, g: 0, b: 0 } : hexToRgb(e.replHex);
        return { targetR: src.r, targetG: src.g, targetB: src.b, replR: repl.r, replG: repl.g, replB: repl.b, transparent: e.transparent, tolerance: e.tolerance };
      });

      const channel = new Channel<ProgressEvent>();
      channel.onmessage = (event: ProgressEvent) => {
        if (event.type === "transform") {
          setApplyProgress({ current: event.frame, total: event.total, phase: "transform" });
        } else if (event.type === "encode") {
          setApplyProgress({ current: event.frame, total: event.total, phase: "encode" });
        }
      };

      const result = await invoke<string>("apply_color_changes", {
        filePath: originalGifPath, mappings, onProgress: channel,
      });
      setModifiedGifData(result);
      setPreviewModeActive(false);
      setPreviewData(null);
    } catch (err) {
      notifications.show({ title: t("err_apply"), message: String(err), color: "red" });
    } finally {
      setApplyLoading(false);
      setApplyProgress(null);
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!modifiedGifData) return;
    try {
      const savePath = await save({ filters: [{ name: "GIF Files", extensions: ["gif"] }], defaultPath: "modified.gif" });
      if (!savePath) return;
      await writeFile(savePath, base64ToUint8Array(modifiedGifData.replace("data:image/gif;base64,", "")));
      notifications.show({ title: t("saved"), message: t("saved_msg", { path: savePath }), color: "green" });
    } catch (err) {
      notifications.show({ title: t("err_save"), message: String(err), color: "red" });
    }
  }

  // ── Status text ─────────────────────────────────────────────────────────────
  const statusText = !hasGif
    ? t("no_file")
    : `${colorEntries.length} ${t(colorEntries.length === 1 ? "color_singular" : "color_plural")} ${t("assigned")}${modifiedGifData ? "" : " · " + t("unsaved")}`;

  const frameLabel = hasFrames
    ? `Frame ${previewFrameIndex + 1} / ${gifFrameCount}`
    : "–";

  const applySubLabel = hasGif && colorEntries.length > 0
    ? `${colorEntries.length} ${t(colorEntries.length === 1 ? "rule_singular" : "rule_plural")} ${t("on_all_frames", { n: gifFrameCount ?? "?" })}`
    : t("apply_hint");

  const applyProgressPct = applyProgress
    ? applyProgress.phase === "transform"
      ? Math.round((applyProgress.current / applyProgress.total) * 50)
      : 50 + Math.round((applyProgress.current / applyProgress.total) * 50)
    : 0;

  const applyProgressLabel = applyProgress
    ? t(applyProgress.phase === "transform" ? "transforming" : "encoding", { current: applyProgress.current, total: applyProgress.total })
    : t("decoding");

  return (
    <div id="app-root" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Titlebar */}
      <div
        className="titlebar"
        onMouseDown={handleTitlebarMouseDown}
        onDoubleClick={() => appWindow.toggleMaximize()}
      >
        <div className="tb-spacer" />
        <span className="tb-title">GIF Color Changer</span>
        <div className="tb-controls">
          <button className="tb-btn" title={t("minimize")} onClick={() => appWindow.minimize()}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
          <button className="tb-btn" title={isMaximized ? t("restore") : t("maximize")} onClick={() => appWindow.toggleMaximize()}>
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="3" y="1" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <rect x="1" y="3" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.2" fill="none" style={{fill:"var(--bg-titlebar)"}}/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
            )}
          </button>
          <button className="tb-btn close" title={t("close")} onClick={() => appWindow.close()}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {/* App body */}
      <div className="app-body">

        {/* Header */}
        <div className="app-header">
          <div className="brand">
            <div className="brand-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 3 C 8 9, 5 12, 5 15.5 a7 7 0 0 0 14 0 C 19 12, 16 9, 12 3 Z" fill="#fff" opacity="0.95"/>
                <circle cx="10" cy="14" r="1.6" fill="#ff5722"/>
              </svg>
            </div>
            <div>
              <div className="brand-name">GIF Color Changer</div>
              <div className="brand-sub">{statusText}</div>
            </div>
          </div>

          <button className="file-pill" onClick={handleOpenFile}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span className="filename">{originalGifFilename ?? t("no_file_pill")}</span>
            <span className="swap-btn">{t("open_other")}</span>
          </button>
        </div>

        {/* Preview row */}
        <div className="preview-row">
          {/* Original */}
          <div className="preview-card">
            <div className="preview-head">
              <span className="preview-label">Original</span>
              {/* resolution placeholder — not tracked in state currently */}
              <span className="preview-meta">{hasGif ? "–" : ""}</span>
            </div>
            <div className={`preview-canvas${eyedropperActive ? " eyedropper" : ""}`} onClick={eyedropperActive ? undefined : undefined}>
              <GifPreview
                src={originalGifData}
                label={t("preview_open")}
                eyedropperActive={eyedropperActive}
                onColorPicked={hex => { setPendingColor(hex); setEyedropperActive(false); }}
              />
            </div>
          </div>

          {/* Modified */}
          <div className="preview-card modified">
            <div className="preview-head">
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                <span className="preview-dot" />
                <span className="preview-label">Modified</span>
              </span>
              <span className="preview-meta">{hasFrames ? frameLabel : ""}</span>
            </div>
            <div className="preview-canvas">
              <GifPreview src={previewData ?? modifiedGifData} label={t("preview_apply")} />
              {previewLoading && (
                <div className="preview-loader">
                  <Loader size="sm" color="white" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls bar */}
        <div className="controls-bar">
          <Toggle
            checked={previewModeActive}
            onChange={v => { if (!hasGif) return; setPreviewModeActive(v); }}
            label={t("live_preview")}
            disabled={!hasGif}
          />
          <div className="controls-divider" />
          <div className="frame-control">
            <RangeSlider
              value={previewFrameIndex}
              min={0}
              max={hasFrames ? (gifFrameCount! - 1) : 0}
              disabled={!hasFrames}
              onChange={setPreviewFrameIndex}
              onChangeEnd={setPreviewFrameIndex}
            />
            <span className="frame-count">
              {hasFrames ? `${previewFrameIndex + 1} / ${gifFrameCount}` : "– / –"}
            </span>
          </div>
        </div>

        {/* Colors card */}
        {hasGif && (
          <ColorEntryList
            entries={colorEntries}
            gifColors={gifColors}
            colorsLoading={colorsLoading}
            tolerance={gifTolerance}
            onToleranceChange={handleGifToleranceChange}
            onRemove={id => setColorEntries(prev => prev.filter(e => e.id !== id))}
            onUpdate={handleUpdateEntry}
            addPanelOpen={addPanelOpen}
            onToggleAddPanel={() => { setAddPanelOpen(v => !v); setEyedropperActive(false); }}
            pendingColor={pendingColor}
            onPendingColorChange={setPendingColor}
            onConfirmAdd={handleConfirmAdd}
            eyedropperActive={eyedropperActive}
            onToggleEyedropper={() => setEyedropperActive(v => !v)}
            gifLoaded={hasGif}
            onPreviewUpdate={handlePreviewUpdate}
          />
        )}

        {/* Footer actions */}
        <div className="footer-actions">
          <button
            className="action-btn primary"
            onClick={handleApply}
            disabled={!hasGif || colorEntries.length === 0 || applyLoading}
          >
            <div className="action-stack">
              <span className="action-label">
                {applyLoading ? applyProgressLabel : t("apply_changes")}
              </span>
              {applyLoading ? (
                applyProgress ? (
                  <Progress
                    value={applyProgressPct}
                    size="xs"
                    color="rgba(26,14,6,0.6)"
                    style={{ marginTop: 4, borderRadius: 99 }}
                    transitionDuration={120}
                  />
                ) : (
                  <span className="action-sub">{t("please_wait")}</span>
                )
              ) : (
                <span className="action-sub">{applySubLabel}</span>
              )}
            </div>
            {applyLoading
              ? <span className="btn-spinner" />
              : <span className="kbd">⌘ ⏎</span>
            }
          </button>

          <button
            className="action-btn secondary"
            onClick={handleSave}
            disabled={!modifiedGifData}
          >
            <div className="action-stack">
              <span className="action-label">{t("save_gif")}</span>
              <span className="action-sub">
                {modifiedGifData ? t("ready_to_save") : t("save_hint")}
              </span>
            </div>
            <span className="kbd">⌘ S</span>
          </button>
        </div>


      </div>

      {/* Full-screen loading overlay */}
      {isLoading && (
        <div className="app-loading-overlay">
          <Loader size="xl" color="white" />
        </div>
      )}

    </div>
  );
}
