import { open } from "@tauri-apps/plugin-dialog";
import { RangeSlider, Toggle } from "./ui";
import { t } from "../i18n";

interface SettingsTabProps {
  lang: "de" | "en" | "fr" | "es";
  onLangChange: (l: "de" | "en" | "fr" | "es") => void;
  defaultTol: number;
  onDefaultTolChange: (v: number) => void;
  livePreviewDefault: boolean;
  onLivePreviewDefaultChange: (v: boolean) => void;
  exportFolder: string;
  onExportFolderChange: (v: string) => void;
  fileSchema: string;
  onFileSchemaChange: (v: string) => void;
  overwrite: "ask" | "replace" | "rename";
  onOverwriteChange: (v: "ask" | "replace" | "rename") => void;
}

function SegControl<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: T[];
  labels: string[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((opt, i) => (
        <button
          key={opt}
          className={`seg-opt${value === opt ? " active" : ""}`}
          onClick={() => onChange(opt)}
        >
          {labels[i]}
        </button>
      ))}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

export function SettingsTab({
  lang, onLangChange,
  defaultTol, onDefaultTolChange,
  livePreviewDefault, onLivePreviewDefaultChange,
  exportFolder, onExportFolderChange,
  fileSchema, onFileSchemaChange,
  overwrite, onOverwriteChange,
}: SettingsTabProps) {

  async function handleBrowseFolder() {
    const dir = await open({ directory: true });
    if (dir) onExportFolderChange(dir as string);
  }

  return (
    <div className="settings-body">
      <div className="settings-header">
        <div>
          <div className="brand-name">{t("sidebar_settings")}</div>
          <div className="brand-sub">{t("settings_auto_saved")}</div>
        </div>
      </div>

      {/* Settings card */}
      <div className="colors-card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <span className="card-title">{t("settings_title")}</span>
        </div>

        {/* Sprache */}
        <div className="settings-row">
          <span className="settings-label">{t("settings_lang")}</span>
          <div className="settings-control">
            <SegControl
              value={lang}
              options={["de", "en", "fr", "es"] as const}
              labels={["DE", "EN", "FR", "ES"]}
              onChange={onLangChange}
            />
          </div>
        </div>

        {/* Standard-Toleranz */}
        <div className="settings-row">
          <span className="settings-label">{t("settings_default_tol")}</span>
          <div className="settings-control">
            <div className="settings-slider-group">
              <RangeSlider value={defaultTol} min={0} max={100} onChange={onDefaultTolChange} onChangeEnd={onDefaultTolChange} />
              <span className="settings-slider-num">{defaultTol}</span>
            </div>
          </div>
        </div>

        {/* Live-Preview Standard */}
        <div className="settings-row">
          <span className="settings-label">{t("settings_live_preview_default")}</span>
          <div className="settings-control">
            <Toggle checked={livePreviewDefault} onChange={onLivePreviewDefaultChange} />
          </div>
        </div>

        {/* Standard-Export-Ordner */}
        <div className="settings-row">
          <span className="settings-label">{t("settings_export_folder")}</span>
          <div className="settings-control" style={{ flex: 1, minWidth: 0 }}>
            <div className="input-row" style={{ flex: 1 }}>
              <span className="ir-icon"><FolderIcon /></span>
              <input
                value={exportFolder}
                placeholder="~/Pictures/GifRecolor"
                onChange={e => onExportFolderChange(e.target.value)}
              />
              <button className="ir-browse" onClick={handleBrowseFolder}>
                {t("batch_browse")}
              </button>
            </div>
          </div>
        </div>

        {/* Datei-Schema */}
        <div className="settings-row">
          <div>
            <span className="settings-label">{t("settings_file_schema")}</span>
          </div>
          <div className="settings-control" style={{ flex: 1, minWidth: 0 }}>
            <div className="input-row" style={{ flex: 1 }}>
              <input
                value={fileSchema}
                placeholder="{name}_recolored.gif"
                onChange={e => onFileSchemaChange(e.target.value)}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
          </div>
        </div>

        {/* Original überschreiben */}
        <div className="settings-row">
          <span className="settings-label">{t("settings_overwrite")}</span>
          <div className="settings-control">
            <SegControl
              value={overwrite}
              options={["ask", "replace", "rename"] as const}
              labels={[t("settings_overwrite_ask"), t("settings_overwrite_replace"), t("settings_overwrite_rename")]}
              onChange={onOverwriteChange}
            />
          </div>
        </div>
      </div>

      {/* About card */}
      <div className="colors-card about-card">
        <strong>{t("settings_about_name")}</strong> — {t("settings_about_version")}
        <br />
        {t("settings_about_tagline")}
        <br />
        <br />
        {t("settings_about_copyright")}
      </div>
    </div>
  );
}
