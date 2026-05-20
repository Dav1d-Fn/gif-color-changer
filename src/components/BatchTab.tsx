import { useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile, mkdir } from "@tauri-apps/plugin-fs";
import { invoke, Channel } from "@tauri-apps/api/core";
import { notifications } from "@mantine/notifications";
import { t } from "../i18n";
import { hexToRgb, base64ToUint8Array, ProgressEvent } from "../utils";
import { ColorEntry } from "./ColorEntryList";

interface GifInfo {
  width: number;
  height: number;
  frameCount: number;
}

interface BatchFile {
  id: string;
  path: string;
  name: string;
  size?: number;
  thumbData?: string;
  info?: GifInfo;
  status: "idle" | "processing" | "done" | "error";
  errorMsg?: string;
}

interface BatchTabProps {
  colorEntries: ColorEntry[];
  onImportRules: () => void;
  onExportRules: () => void;
  defaultExportFolder: string;
  defaultFileSchema: string;
}

let batchIdCounter = 0;
function newBatchId() { return String(++batchIdCounter); }

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function resolveSchema(schema: string, filename: string, index: number): string {
  const base = filename.replace(/\.gif$/i, "");
  const today = new Date().toISOString().slice(0, 10);
  return schema
    .replace(/\{name\}/g, base)
    .replace(/\{date\}/g, today)
    .replace(/\{index\}/g, String(index + 1));
}

function ImportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}
function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
function FilePlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="18" x2="12" y2="12"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
  );
}

export function BatchTab({
  colorEntries,
  onImportRules,
  onExportRules,
  defaultExportFolder,
  defaultFileSchema,
}: BatchTabProps) {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [exportFolder, setExportFolder] = useState(defaultExportFolder || "");
  const [fileSchema, setFileSchema] = useState(defaultFileSchema || "{name}_recolored.gif");
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchDone, setBatchDone] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const filesRef = useRef(files);
  filesRef.current = files;

  const totalFrames = files.reduce((s, f) => s + (f.info?.frameCount ?? 0), 0);
  const estSec = Math.ceil(totalFrames * 0.05);
  const exampleName = files[0] ? resolveSchema(fileSchema, files[0].name, 0) : `example_recolored.gif`;

  function setFileStatus(id: string, status: BatchFile["status"], errorMsg?: string) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status, errorMsg } : f));
  }

  async function addFilePaths(paths: string[]) {
    const existingPaths = new Set(filesRef.current.map(f => f.path));
    const newPaths = paths.filter(p => !existingPaths.has(p));
    if (newPaths.length === 0) return;

    const newEntries: BatchFile[] = newPaths.map(p => ({
      id: newBatchId(),
      path: p,
      name: p.split(/[\\/]/).pop() ?? p,
      status: "idle" as const,
    }));
    setFiles(prev => [...prev, ...newEntries]);

    // Load metadata + thumbnails asynchronously
    for (const entry of newEntries) {
      try {
        const [info, bytes] = await Promise.all([
          invoke<GifInfo>("get_gif_info", { filePath: entry.path }),
          readFile(entry.path),
        ]);
        const b64 = btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(""));
        const thumbData = `data:image/gif;base64,${b64}`;
        setFiles(prev => prev.map(f => f.id === entry.id
          ? { ...f, info, thumbData, size: bytes.length }
          : f
        ));
      } catch {
        // ignore metadata errors — file still usable
      }
    }
  }

  async function handleAddGifs() {
    const selected = await open({ multiple: true, filters: [{ name: "GIF Files", extensions: ["gif"] }] });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await addFilePaths(paths as string[]);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }
  function handleDragLeave() { setIsDragOver(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const gifPaths = droppedFiles
      .filter(f => f.name.toLowerCase().endsWith(".gif"))
      // @ts-expect-error Tauri extends File with .path
      .map(f => f.path as string)
      .filter(Boolean);
    if (gifPaths.length > 0) addFilePaths(gifPaths);
  }

  async function handleBrowseFolder() {
    const dir = await open({ directory: true });
    if (dir) setExportFolder(dir as string);
  }

  async function handleProcess() {
    if (files.length === 0 || colorEntries.length === 0) return;
    if (!exportFolder.trim()) {
      notifications.show({ title: t("batch_err_no_folder"), message: "", color: "red" });
      return;
    }

    setIsProcessing(true);
    setBatchDone(false);
    setDoneCount(0);

    const mappings = colorEntries.map(e => {
      const src  = hexToRgb(e.sourceHex);
      const repl = e.transparent ? { r: 0, g: 0, b: 0 } : hexToRgb(e.replHex);
      return {
        targetR: src.r, targetG: src.g, targetB: src.b,
        replR: repl.r, replG: repl.g, replB: repl.b,
        transparent: e.transparent, tolerance: e.tolerance,
      };
    });

    try {
      await mkdir(exportFolder, { recursive: true });
    } catch { /* might already exist */ }

    let done = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setFileStatus(file.id, "processing");
      try {
        const channel = new Channel<ProgressEvent>();
        channel.onmessage = () => {};
        const b64 = await invoke<string>("apply_color_changes", {
          filePath: file.path, mappings, onProgress: channel,
        });
        const outName = resolveSchema(fileSchema, file.name, i);
        const outPath = `${exportFolder}/${outName}`;
        await writeFile(outPath, base64ToUint8Array(b64.replace("data:image/gif;base64,", "")));
        setFileStatus(file.id, "done");
        done++;
        setDoneCount(done);
      } catch (err) {
        setFileStatus(file.id, "error", String(err));
      }
    }

    setIsProcessing(false);
    setBatchDone(true);
    notifications.show({
      title: t("batch_done_toast", { n: done }),
      message: exportFolder,
      color: "green",
    });
  }

  function handleOpenFolder() {
    invoke("open_path", { path: exportFolder }).catch(() => {});
  }

  const canProcess = files.length > 0 && colorEntries.length > 0 && !isProcessing && exportFolder.trim() !== "";

  return (
    <div className="batch-body">
      {/* Header */}
      <div className="batch-header">
        <div className="batch-title-block">
          <div className="batch-title">{t("batch_title")}</div>
          <div className="batch-sub">
            {files.length === 0
              ? t("batch_sub_none")
              : t("batch_sub", { n: files.length, r: colorEntries.length })}
          </div>
        </div>
        <button className="btn-secondary" onClick={handleAddGifs}>
          <FilePlusIcon /> {t("batch_add_gifs")}
        </button>
      </div>

      {/* Body grid */}
      <div className="batch-grid">

        {/* Left — file list */}
        <div
          className="colors-card"
          style={{ borderColor: isDragOver ? "var(--accent)" : undefined }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="card-head">
            <span className="card-title">
              {t("batch_card_files")}
              <span className="count">· {files.length}</span>
            </span>
            {files.length > 0 && (
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setFiles([]); setBatchDone(false); }}>
                {t("batch_remove_all")}
              </button>
            )}
          </div>

          {files.length === 0 ? (
            <div className="batch-empty">
              <div className="batch-empty-icon"><UploadIcon /></div>
              <div className="batch-empty-label">{t("batch_empty_label")}</div>
              <div className="batch-empty-hint">{t("batch_empty_hint")}</div>
            </div>
          ) : (
            <>
              <div className="file-list">
                {files.map(f => (
                  <div key={f.id} className="file-row">
                    <div className="file-thumb">
                      {f.thumbData && <img src={f.thumbData} alt={f.name} />}
                    </div>
                    <div className="file-meta">
                      <div className="file-name">{f.name}</div>
                      <div className="file-info">
                        {f.info
                          ? `${f.info.width}×${f.info.height} · ${f.info.frameCount} Frames${f.size ? ` · ${formatBytes(f.size)}` : ""}`
                          : f.size ? formatBytes(f.size) : "…"}
                      </div>
                    </div>
                    <div className={`file-status${f.status !== "idle" ? " " + f.status : ""}`}>
                      {f.status === "idle"       && t("batch_status_idle")}
                      {f.status === "processing" && t("batch_status_proc")}
                      {f.status === "done"       && t("batch_status_done")}
                      {f.status === "error"      && t("batch_status_error")}
                    </div>
                    <button
                      className="icon-btn danger"
                      title={t("btn_remove")}
                      disabled={isProcessing}
                      onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
              <div className="drop-hint-row">{t("batch_drop_hint")}</div>
            </>
          )}
        </div>

        {/* Right — side cards */}
        <div className="side-cards">

          {/* Rules mirror card */}
          <div className="colors-card">
            <div className="card-head">
              <span className="card-title">
                {t("batch_card_rules")}
                <span className="count">· {colorEntries.length}</span>
              </span>
              <div className="card-head-actions">
                <button className="icon-btn" title={t("rules_import_tooltip")} onClick={onImportRules}>
                  <ImportIcon />
                </button>
                <button
                  className="icon-btn"
                  title={t("rules_export_tooltip")}
                  onClick={onExportRules}
                  disabled={colorEntries.length === 0}
                >
                  <ExportIcon />
                </button>
              </div>
            </div>
            {colorEntries.length === 0 ? (
              <div className="empty-state">{t("no_colors")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {colorEntries.map(e => (
                  <div key={e.id} className="rule-mini">
                    {e.transparent ? (
                      <div className="rule-mini-swatch transparent" />
                    ) : (
                      <div className="rule-mini-swatch" style={{ backgroundColor: e.sourceHex }} />
                    )}
                    <span className="hex-label" style={{ fontSize: 11.5 }}>{e.sourceHex.toUpperCase()}</span>
                    <span className="arrow">→</span>
                    {e.transparent ? (
                      <div className="rule-mini-swatch transparent" />
                    ) : (
                      <div className="rule-mini-swatch" style={{ backgroundColor: e.replHex }} />
                    )}
                    <span className="hex-label" style={{ fontSize: 11.5 }}>
                      {e.transparent ? "transparent" : e.replHex.toUpperCase()}
                    </span>
                    <span className="row-meta" style={{ marginLeft: "auto", fontSize: 10.5 }}>
                      {t("tol_prefix")} {e.tolerance}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="rules-note">{t("batch_rules_note")}</p>
          </div>

          {/* Export card */}
          <div className="colors-card">
            <div className="card-head">
              <span className="card-title">{t("batch_card_export")}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Ziel-Ordner */}
              <div className="field-group">
                <div className="field-label">{t("batch_dest_folder")}</div>
                <div className="input-row">
                  <span className="ir-icon"><FolderIcon /></span>
                  <input
                    value={exportFolder}
                    placeholder="~/Pictures/GifRecolor/Batch"
                    onChange={e => setExportFolder(e.target.value)}
                  />
                  <button className="ir-browse" onClick={handleBrowseFolder}>
                    {t("batch_browse")}
                  </button>
                </div>
              </div>

              {/* Datei-Schema */}
              <div className="field-group">
                <div className="field-label">{t("batch_schema")}</div>
                <div className="input-row">
                  <input
                    value={fileSchema}
                    onChange={e => setFileSchema(e.target.value)}
                    style={{ fontFamily: "'JetBrains Mono', monospace", padding: "10px 12px" }}
                  />
                </div>
                <div className="pattern-help">
                  {t("batch_schema_help", { example: exampleName })}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="footer-actions">
        <button
          className="action-btn primary"
          onClick={handleProcess}
          disabled={!canProcess}
        >
          <div className="action-stack">
            <span className="action-label">{t("batch_process_btn")}</span>
            <span className="action-sub">
              {t("batch_process_sub", { n: files.length, f: totalFrames, s: estSec })}
            </span>
          </div>
          <span className="kbd">⌘ ⏎</span>
        </button>

        <button
          className="action-btn secondary"
          onClick={handleOpenFolder}
          disabled={!batchDone}
        >
          <div className="action-stack">
            <span className="action-label">{t("batch_open_folder")}</span>
            <span className="action-sub">
              {batchDone
                ? t("batch_open_sub_done", { n: doneCount })
                : t("batch_open_sub_wait")}
            </span>
          </div>
          <span className="kbd">⌘ O</span>
        </button>
      </div>
    </div>
  );
}
