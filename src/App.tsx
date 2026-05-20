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
import { BatchTab } from "./components/BatchTab";
import { SettingsTab } from "./components/SettingsTab";
import { t, setLanguage, registerLangCallback } from "./i18n";
import { hexToRgb, base64ToUint8Array, ProgressEvent } from "./utils";

let entryIdCounter = 0;
function newId() { return String(++entryIdCounter); }

const appWindow = getCurrentWindow();

// ── Sidebar icons ─────────────────────────────────────────────────────────────
function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-3v-7h-8v7H5a2 2 0 0 1-2-2z"/>
    </svg>
  );
}
function BatchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5"/>
      <rect x="13" y="3" width="8" height="8" rx="1.5"/>
      <rect x="3" y="13" width="8" height="8" rx="1.5"/>
      <rect x="13" y="13" width="8" height="8" rx="1.5"/>
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

const NAV_ITEMS: Array<{ tab: "home" | "batch" | "settings"; icon: JSX.Element; labelKey: "sidebar_home" | "sidebar_batch" | "sidebar_settings" }> = [
  { tab: "home",     icon: <HomeIcon />,     labelKey: "sidebar_home" },
  { tab: "batch",    icon: <BatchIcon />,    labelKey: "sidebar_batch" },
  { tab: "settings", icon: <SettingsIcon />, labelKey: "sidebar_settings" },
];

const LANG_CYCLE: Array<"de" | "en" | "fr" | "es"> = ["de", "en", "fr", "es"];

export default function App() {
  // ── Tab & lang ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"home" | "batch" | "settings">("home");
  const [, setLangTick] = useState(0);

  // ── Settings (persisted to localStorage) ───────────────────────────────────
  const [settingsLang, setSettingsLang] = useState<"de" | "en" | "fr" | "es">(
    () => (localStorage.getItem("lang") as "de" | "en" | "fr" | "es") ||
          (navigator.language.startsWith("de") ? "de" : "en")
  );
  const [settingsDefaultTol, setSettingsDefaultTol] = useState(
    () => Number(localStorage.getItem("defaultTol") ?? 35)
  );
  const [settingsLivePreview, setSettingsLivePreview] = useState(
    () => localStorage.getItem("livePreview") !== "false"
  );
  const [settingsExportFolder, setSettingsExportFolder] = useState(
    () => localStorage.getItem("exportFolder") || ""
  );
  const [settingsFileSchema, setSettingsFileSchema] = useState(
    () => localStorage.getItem("fileSchema") || "{name}_recolored.gif"
  );
  const [settingsOverwrite, setSettingsOverwrite] = useState<"ask" | "replace" | "rename">(
    () => (localStorage.getItem("overwrite") as "ask" | "replace" | "rename") || "ask"
  );

  // ── Home state ──────────────────────────────────────────────────────────────
  const [originalGifPath,  setOriginalGifPath]  = useState<string | null>(null);
  const [originalGifData,  setOriginalGifData]  = useState<string | null>(null);
  const [gifColors,        setGifColors]        = useState<RgbColor[]>([]);
  const [colorEntries,     setColorEntries]     = useState<ColorEntry[]>([]);
  const [addPanelOpen,     setAddPanelOpen]     = useState(false);
  const [pendingColor,     setPendingColor]     = useState("#ff0000");
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [gifTolerance,     setGifTolerance]     = useState(settingsDefaultTol);
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

  // ── Rules import dialog ─────────────────────────────────────────────────────
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<ColorEntry[] | null>(null);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    registerLangCallback(() => setLangTick(n => n + 1));
    setLanguage(settingsLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Settings helpers ────────────────────────────────────────────────────────
  function updateLang(l: "de" | "en" | "fr" | "es") {
    setSettingsLang(l);
    localStorage.setItem("lang", l);
    setLanguage(l);
  }
  function cycleLang() {
    const next = LANG_CYCLE[(LANG_CYCLE.indexOf(settingsLang) + 1) % LANG_CYCLE.length];
    updateLang(next);
  }
  function updateDefaultTol(v: number) { setSettingsDefaultTol(v); localStorage.setItem("defaultTol", String(v)); }
  function updateLivePreview(v: boolean) { setSettingsLivePreview(v); localStorage.setItem("livePreview", String(v)); }
  function updateExportFolder(v: string) { setSettingsExportFolder(v); localStorage.setItem("exportFolder", v); }
  function updateFileSchema(v: string)   { setSettingsFileSchema(v);   localStorage.setItem("fileSchema",   v); }
  function updateOverwrite(v: "ask" | "replace" | "rename") { setSettingsOverwrite(v); localStorage.setItem("overwrite", v); }

  // ── Maximize tracking ───────────────────────────────────────────────────────
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

  // ── Color entries ───────────────────────────────────────────────────────────
  function handleConfirmAdd(replHex: string, transparent: boolean, tolerance: number) {
    setColorEntries(prev => [...prev, { id: newId(), sourceHex: pendingColor, replHex, transparent, tolerance }]);
    setAddPanelOpen(false);
    setEyedropperActive(false);
  }

  function handleUpdateEntry(id: string, changes: Partial<Omit<ColorEntry, "id">>) {
    setColorEntries(prev => prev.map(e => e.id === id ? { ...e, ...changes } : e));
  }

  // ── Live preview ────────────────────────────────────────────────────────────
  useEffect(() => {
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
    setPreviewTrigger(n => n + 1);
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
      const result = await invoke<string>("apply_color_changes", { filePath: originalGifPath, mappings, onProgress: channel });
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

  // ── Rules export ─────────────────────────────────────────────────────────────
  async function handleExportRules() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const savePath = await save({
        filters: [{ name: "GifRecolor Rules", extensions: ["json"] }],
        defaultPath: `gifrecolor-rules-${today}.json`,
      });
      if (!savePath) return;
      const payload = {
        format: "gifrecolor.rules",
        version: 1,
        createdAt: new Date().toISOString(),
        rules: colorEntries.map(e => ({
          from: e.sourceHex.toUpperCase(),
          to: e.transparent ? null : e.replHex.toUpperCase(),
          tolerance: e.tolerance,
          transparent: e.transparent,
        })),
      };
      await writeFile(savePath, new TextEncoder().encode(JSON.stringify(payload, null, 2)));
      notifications.show({
        title: t("rules_export_success", { n: colorEntries.length }),
        message: savePath,
        color: "green",
      });
    } catch (err) {
      notifications.show({ title: t("err_save"), message: String(err), color: "red" });
    }
  }

  // ── Rules import ─────────────────────────────────────────────────────────────
  async function handleImportRules() {
    try {
      const filePath = await open({ multiple: false, filters: [{ name: "GifRecolor Rules", extensions: ["json"] }] });
      if (!filePath) return;
      const bytes = await readFile(filePath as string);
      const parsed = JSON.parse(new TextDecoder().decode(bytes));
      if (parsed.format !== "gifrecolor.rules" || !Array.isArray(parsed.rules)) {
        throw new Error("invalid format");
      }
      const imported: ColorEntry[] = parsed.rules.map((r: { from: string; to: string | null; tolerance: number; transparent: boolean }) => ({
        id: newId(),
        sourceHex: r.from.toLowerCase(),
        replHex: r.to ? r.to.toLowerCase() : "#000000",
        tolerance: r.tolerance ?? 0,
        transparent: !!r.transparent,
      }));
      if (colorEntries.length > 0) {
        setPendingImport(imported);
        setImportDialogOpen(true);
      } else {
        setColorEntries(imported);
      }
    } catch {
      notifications.show({ title: t("rules_import_error"), message: "", color: "red" });
    }
  }

  function applyImport(rules: ColorEntry[], mode: "replace" | "add") {
    if (mode === "replace") {
      setColorEntries(rules);
    } else {
      setColorEntries(prev => [...prev, ...rules]);
    }
  }

  // ── Status / labels ──────────────────────────────────────────────────────────
  const statusText = !hasGif
    ? t("no_file")
    : `${colorEntries.length} ${t(colorEntries.length === 1 ? "color_singular" : "color_plural")} ${t("assigned")}${modifiedGifData ? "" : " · " + t("unsaved")}`;

  const frameLabel = hasFrames ? `Frame ${previewFrameIndex + 1} / ${gifFrameCount}` : "–";

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

      {/* App shell: sidebar + tab content */}
      <div className="app-shell">

        {/* Sidebar */}
        <aside className="sidebar">
          {/* Brand mark */}
          <div className="brand-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 3 C 8 9, 5 12, 5 15.5 a7 7 0 0 0 14 0 C 19 12, 16 9, 12 3 Z" fill="#fff" opacity="0.95"/>
              <circle cx="10" cy="14" r="1.6" fill="#ff5722"/>
            </svg>
          </div>

          <div className="sidebar-spacer-sm" />

          {/* Nav items */}
          {NAV_ITEMS.map(({ tab, icon, labelKey }) => (
            <button
              key={tab}
              className={`nav-item${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {icon}
              <span className="nav-tooltip">{t(labelKey)}</span>
            </button>
          ))}

          <div className="sidebar-spacer" />
          <div className="sidebar-divider" />

          {/* Language switcher */}
          <button className="lang-btn" title={t("lang_switch_tooltip")} onClick={cycleLang}>
            {settingsLang.toUpperCase()}
          </button>
        </aside>

        {/* Tab panes (never unmounted) */}
        <div className="tab-content">

          {/* ── Home tab ─────────────────────────────────────────── */}
          <div className={`tab-pane${activeTab === "home" ? " active" : ""}`}>
            <div className="app-body">

              {/* Home header (brand-mark removed, title shrunk) */}
              <div className="app-header">
                <div className="brand">
                  <div>
                    <div className="brand-name">{t("home_title")}</div>
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
                <div className="preview-card">
                  <div className="preview-head">
                    <span className="preview-label">Original</span>
                    <span className="preview-meta">{hasGif ? "–" : ""}</span>
                  </div>
                  <div className={`preview-canvas${eyedropperActive ? " eyedropper" : ""}`}>
                    <GifPreview
                      src={originalGifData}
                      label={t("preview_open")}
                      eyedropperActive={eyedropperActive}
                      onColorPicked={hex => { setPendingColor(hex); setEyedropperActive(false); }}
                    />
                  </div>
                </div>

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
                  onImport={handleImportRules}
                  onExport={handleExportRules}
                />
              )}

              {/* Footer */}
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
          </div>

          {/* ── Batch tab ─────────────────────────────────────────── */}
          <div className={`tab-pane${activeTab === "batch" ? " active" : ""}`}>
            <BatchTab
              colorEntries={colorEntries}
              onImportRules={handleImportRules}
              onExportRules={handleExportRules}
              defaultExportFolder={settingsExportFolder}
              defaultFileSchema={settingsFileSchema}
            />
          </div>

          {/* ── Settings tab ──────────────────────────────────────── */}
          <div className={`tab-pane${activeTab === "settings" ? " active" : ""}`}>
            <SettingsTab
              lang={settingsLang}
              onLangChange={updateLang}
              defaultTol={settingsDefaultTol}
              onDefaultTolChange={updateDefaultTol}
              livePreviewDefault={settingsLivePreview}
              onLivePreviewDefaultChange={updateLivePreview}
              exportFolder={settingsExportFolder}
              onExportFolderChange={updateExportFolder}
              fileSchema={settingsFileSchema}
              onFileSchemaChange={updateFileSchema}
              overwrite={settingsOverwrite}
              onOverwriteChange={updateOverwrite}
            />
          </div>

        </div>
      </div>

      {/* Import confirmation dialog */}
      {importDialogOpen && pendingImport && (
        <div className="app-loading-overlay" style={{ alignItems: "flex-start", paddingTop: 80 }}>
          <div className="colors-card" style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{t("rules_import_title")}</div>
            <p className="brand-sub" style={{ marginBottom: 0 }}>
              {t("rules_import_body", { n: colorEntries.length })}
            </p>
            <div className="edit-actions" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setImportDialogOpen(false)}>{t("cancel")}</button>
              <div className="edit-actions-right">
                <button className="btn btn-ghost" onClick={() => { applyImport(pendingImport, "add"); setImportDialogOpen(false); }}>
                  {t("rules_import_add")}
                </button>
                <button className="btn btn-accent" onClick={() => { applyImport(pendingImport, "replace"); setImportDialogOpen(false); }}>
                  {t("rules_import_replace")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen loading overlay */}
      {isLoading && (
        <div className="app-loading-overlay">
          <Loader size="xl" color="white" />
        </div>
      )}

    </div>
  );
}
