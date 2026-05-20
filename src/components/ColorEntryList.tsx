import { useRef, useState } from "react";
import { ColorPicker, Loader } from "@mantine/core";
import { Toggle, RangeSlider, Swatch, TransparentSwatch } from "./ui";
import { t } from "../i18n";

export interface ColorEntry {
  id: string;
  sourceHex: string;
  replHex: string;
  transparent: boolean;
  tolerance: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function rgbToHex({ r, g, b }: RgbColor): string {
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

function isValidHex(v: string) { return /^#[0-9a-fA-F]{6}$/.test(v); }

// ── Icon SVGs ─────────────────────────────────────────────────────────────────
function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
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
function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
      <path d="M6 2v8M2 6h8"/>
    </svg>
  );
}
function BackIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round">
      <path d="M5 2L2 6l3 4M2 6h8"/>
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

// ── Hex input ─────────────────────────────────────────────────────────────────
function HexInput({ value, onChange }: { value: string; onChange: (h: string) => void }) {
  const [raw, setRaw] = useState(value);
  if (isValidHex(value) && value !== raw) setRaw(value);
  const error = raw.length > 0 && !isValidHex(raw);
  return (
    <div className="hex-input-row">
      <div className="hex-preview" style={{ backgroundColor: isValidHex(raw) ? raw : "#000" }} />
      <input
        className={`hex-input${error ? " error" : ""}`}
        value={raw}
        placeholder="#rrggbb"
        onChange={e => {
          const v = e.currentTarget.value;
          setRaw(v);
          if (isValidHex(v)) onChange(v);
        }}
      />
    </div>
  );
}

// ── EntryRow ──────────────────────────────────────────────────────────────────
interface EntryRowProps {
  entry: ColorEntry;
  onRemove: () => void;
  onUpdate: (changes: Partial<Omit<ColorEntry, "id">>) => void;
  onLiveState?: (entry: ColorEntry | null) => void;
  gifColors: RgbColor[];
  colorsLoading: boolean;
  gifTolerance: number;
  onGifToleranceChange: (v: number) => void;
  eyedropperActive: boolean;
  onToggleEyedropper: () => void;
  gifLoaded: boolean;
  pendingColor: string;
  onPendingColorChange: (hex: string) => void;
}

function EntryRow({
  entry, onRemove, onUpdate, onLiveState,
  eyedropperActive, onToggleEyedropper, gifLoaded,
  pendingColor, onPendingColorChange,
  gifColors, colorsLoading,
}: EntryRowProps) {
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [localReplHexa, setLocalReplHexa] = useState(entry.replHex + "ff");
  const localReplHexaRef = useRef(entry.replHex + "ff");
  const [localTransparent, setLocalTransparent] = useState(entry.transparent);
  const [localTol, setLocalTol] = useState(entry.tolerance);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replHexRgb = localReplHexa.slice(0, 7);

  function fireLive(overrides?: Partial<Pick<ColorEntry, "replHex"|"transparent"|"tolerance"|"sourceHex">>) {
    onLiveState?.({
      id: entry.id,
      sourceHex: overrides?.sourceHex ?? pendingColor,
      replHex: overrides?.replHex ?? localReplHexaRef.current.slice(0, 7),
      transparent: overrides?.transparent ?? localTransparent,
      tolerance: overrides?.tolerance ?? localTol,
    });
  }

  function updateReplHexa(v: string) {
    setLocalReplHexa(v);
    localReplHexaRef.current = v;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fireLive({ replHex: v.slice(0, 7) }), 300);
  }

  function openEdit() {
    setLocalReplHexa(entry.replHex + "ff");
    localReplHexaRef.current = entry.replHex + "ff";
    setLocalTransparent(entry.transparent);
    setLocalTol(entry.tolerance);
    onPendingColorChange(entry.sourceHex);
    setStep(2);
    setEditing(true);
  }

  function handleDone() {
    onUpdate({
      sourceHex: pendingColor,
      replHex: localReplHexaRef.current.slice(0, 7),
      transparent: localTransparent,
      tolerance: localTol,
    });
    onLiveState?.(null);
    setEditing(false);
  }

  function handleTransparentChange(v: boolean) {
    setLocalTransparent(v);
    fireLive({ transparent: v });
  }

  if (!editing) {
    return (
      <div className="mapping">
        <div className="mapping-row">
          <Swatch hex={entry.sourceHex} />
          <span className="hex-label">{entry.sourceHex.toUpperCase()}</span>
          <span className="arrow">→</span>
          {entry.transparent ? <TransparentSwatch /> : <Swatch hex={entry.replHex} />}
          <span className="hex-label">{entry.transparent ? "transparent" : entry.replHex.toUpperCase()}</span>
          <span className="row-meta" style={{ marginLeft: 10 }}>{t("tol_prefix")} {entry.tolerance}</span>
        </div>
        <div className="mapping-actions">
          <button className="icon-btn" title={t("btn_edit")} onClick={openEdit}><EditIcon /></button>
          <button className="icon-btn danger" title={t("btn_remove")} onClick={onRemove}><TrashIcon /></button>
        </div>
      </div>
    );
  }

  function closeEdit() { onLiveState?.(null); setEditing(false); }

  if (step === 1) {
    return (
      <div className="mapping editing">
        <div className="step1-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span className="option-label">{t("choose_source")}</span>
          </div>

          {colorsLoading
            ? <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}><Loader size="sm" /></div>
            : gifColors.length > 0 && (
              <div className="palette-row">
                {gifColors.map((c, i) => {
                  const hex = rgbToHex(c);
                  return (
                    <div
                      key={i}
                      className={`swatch-sm${pendingColor === hex ? " active" : ""}`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                      onClick={() => onPendingColorChange(hex)}
                    />
                  );
                })}
              </div>
            )
          }

          <HexInput value={pendingColor} onChange={onPendingColorChange} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className={`eyedrop-btn${eyedropperActive ? " active" : ""}`}
              disabled={!gifLoaded}
              onClick={onToggleEyedropper}
            >
              <EyeIcon /> {t("pick_from_gif")}
            </button>
          </div>

          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={closeEdit}><BackIcon /> {t("back")}</button>
            <button className="btn btn-accent" onClick={() => { if (eyedropperActive) onToggleEyedropper(); setStep(2); }}>
              {t("next")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mapping editing">
      {/* top mapping row */}
      <div className="edit-mapping-row">
        <Swatch hex={pendingColor} />
        <span className="hex-label">{pendingColor.toUpperCase()}</span>
        <span className="arrow">→</span>
        {localTransparent ? <TransparentSwatch /> : <Swatch hex={replHexRgb} />}
        <span className={`hex-label${localTransparent ? " muted" : ""}`}>
          {localTransparent ? "transparent" : replHexRgb.toUpperCase()}
        </span>
        <div style={{ flex: 1 }} />
        <span className="row-meta accent">{t("badge_editing")}</span>
      </div>

      <div className="edit-options">
        <div className="option-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Toggle checked={localTransparent} onChange={handleTransparentChange} />
            <span className="option-label">{t("make_transparent")}</span>
          </div>
          <span className="option-hint">{t("transparent_hint")}</span>
        </div>

        {!localTransparent && (
          <div className="color-picker-section">
            <ColorPicker format="hexa" value={localReplHexa} onChange={updateReplHexa} fullWidth />
            <div style={{ marginTop: 8 }}>
              <HexInput
                value={replHexRgb}
                onChange={hex => updateReplHexa(hex + localReplHexa.slice(7))}
              />
            </div>
          </div>
        )}

        <div className="option-row">
          <div>
            <span className="option-label">{t("tolerance")}</span>
            <span className="option-hint"> — {t("tolerance_hint")}</span>
          </div>
          <div className="slider-group">
            <RangeSlider
              value={localTol}
              onChange={v => { setLocalTol(v); fireLive({ tolerance: v }); }}
            />
            <span className="slider-num">{localTol}</span>
          </div>
        </div>
      </div>

      <div className="edit-actions">
        <button className="btn btn-ghost" onClick={() => setStep(1)}>
          <BackIcon /> {t("back")}
        </button>
        <div className="edit-actions-right">
          <button className="btn btn-ghost" onClick={closeEdit}>{t("cancel")}</button>
          <button className="btn btn-accent" onClick={handleDone}>{t("confirm")}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add panel ─────────────────────────────────────────────────────────────────
interface AddPanelProps {
  pendingColor: string;
  onPendingColorChange: (hex: string) => void;
  gifColors: RgbColor[];
  colorsLoading: boolean;
  gifTolerance: number;
  onGifToleranceChange: (v: number) => void;
  eyedropperActive: boolean;
  onToggleEyedropper: () => void;
  gifLoaded: boolean;
  onConfirm: (replHex: string, transparent: boolean, tolerance: number) => void;
  onCancel: () => void;
  onLivePreview?: (replHex: string, transparent: boolean, tolerance: number) => void;
}

function AddPanel({
  pendingColor, onPendingColorChange,
  gifColors, colorsLoading, gifTolerance, onGifToleranceChange,
  eyedropperActive, onToggleEyedropper, gifLoaded,
  onConfirm, onCancel, onLivePreview,
}: AddPanelProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [replHexa, setReplHexa] = useState("#ff0000ff");
  const replHexaRef = useRef("#ff0000ff");
  const [transparent, setTransparent] = useState(false);
  const [tol, setTol] = useState(20);
  const [localGifTol, setLocalGifTol] = useState(gifTolerance);
  const liveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replHexRgb = replHexa.slice(0, 7);

  function fireLive(overrides?: { replHex?: string; transparent?: boolean; tolerance?: number }) {
    const rh  = overrides?.replHex     ?? replHexaRef.current.slice(0, 7);
    const tr  = overrides?.transparent ?? transparent;
    const tl  = overrides?.tolerance   ?? tol;
    onLivePreview?.(rh, tr, tl);
  }

  function updateReplHexa(v: string) {
    setReplHexa(v);
    replHexaRef.current = v;
    if (liveDebounce.current) clearTimeout(liveDebounce.current);
    liveDebounce.current = setTimeout(() => fireLive({ replHex: v.slice(0, 7) }), 300);
  }

  function handleTransparentChange(v: boolean) {
    setTransparent(v);
    fireLive({ transparent: v });
  }

  function handleTolChange(v: number) {
    setTol(v);
    fireLive({ tolerance: v });
  }

  if (step === 1) {
    return (
      <div className="add-panel">
        <div className="step1-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span className="option-label">{t("choose_source")}</span>
            <div className="gif-tol-row">
              <span className="gif-tol-label">{t("gif_tolerance")}</span>
              <RangeSlider min={30} max={100} value={localGifTol}
                onChange={setLocalGifTol}
                onChangeEnd={v => { setLocalGifTol(v); onGifToleranceChange(v); }}
              />
              <span className="slider-num" style={{ minWidth: 28 }}>{localGifTol}</span>
            </div>
          </div>

          {colorsLoading
            ? <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}><Loader size="sm" /></div>
            : gifColors.length > 0 && (
              <div className="palette-row">
                {gifColors.map((c, i) => {
                  const hex = rgbToHex(c);
                  return (
                    <div
                      key={i}
                      className={`swatch-sm${pendingColor === hex ? " active" : ""}`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                      onClick={() => onPendingColorChange(hex)}
                    />
                  );
                })}
              </div>
            )
          }

          <HexInput value={pendingColor} onChange={onPendingColorChange} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className={`eyedrop-btn${eyedropperActive ? " active" : ""}`}
              disabled={!gifLoaded}
              onClick={onToggleEyedropper}
            >
              <EyeIcon /> {t("pick_from_gif")}
            </button>
          </div>

          <div className="edit-actions">
            <button className="btn btn-ghost" onClick={onCancel}>{t("cancel")}</button>
            <button className="btn btn-accent" onClick={() => { if (eyedropperActive) onToggleEyedropper(); setStep(2); }}>
              {t("next")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="add-panel">
      {/* mapping preview row */}
      <div className="edit-mapping-row">
        <Swatch hex={pendingColor} />
        <span className="hex-label">{pendingColor.toUpperCase()}</span>
        <span className="arrow">→</span>
        {transparent ? <TransparentSwatch /> : <Swatch hex={replHexRgb} />}
        <span className={`hex-label${transparent ? " muted" : ""}`}>
          {transparent ? "transparent" : replHexRgb.toUpperCase()}
        </span>
      </div>

      <div className="edit-options">
        <div className="option-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Toggle checked={transparent} onChange={handleTransparentChange} />
            <span className="option-label">{t("make_transparent")}</span>
          </div>
          <span className="option-hint">{t("transparent_hint")}</span>
        </div>

        {!transparent && (
          <div className="color-picker-section">
            <ColorPicker format="hexa" value={replHexa} onChange={updateReplHexa} fullWidth />
            <div style={{ marginTop: 8 }}>
              <HexInput value={replHexRgb} onChange={hex => updateReplHexa(hex + replHexa.slice(7))} />
            </div>
          </div>
        )}

        <div className="option-row">
          <div>
            <span className="option-label">{t("tolerance")}</span>
            <span className="option-hint"> — {t("tolerance_hint")}</span>
          </div>
          <div className="slider-group">
            <RangeSlider value={tol} onChange={handleTolChange} />
            <span className="slider-num">{tol}</span>
          </div>
        </div>
      </div>

      <div className="edit-actions">
        <button className="btn btn-ghost" onClick={() => setStep(1)}><BackIcon /> {t("back")}</button>
        <div className="edit-actions-right">
          <button className="btn btn-ghost" onClick={onCancel}>{t("cancel")}</button>
          <button className="btn btn-accent" onClick={() => onConfirm(replHexaRef.current.slice(0, 7), transparent, tol)}>
            {t("add")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ColorEntryList ────────────────────────────────────────────────────────────
interface ColorEntryListProps {
  entries: ColorEntry[];
  gifColors: RgbColor[];
  colorsLoading: boolean;
  tolerance: number;
  onToleranceChange: (v: number) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, changes: Partial<Omit<ColorEntry, "id">>) => void;
  addPanelOpen: boolean;
  onToggleAddPanel: () => void;
  pendingColor: string;
  onPendingColorChange: (hex: string) => void;
  onConfirmAdd: (replHex: string, transparent: boolean, tolerance: number) => void;
  eyedropperActive: boolean;
  onToggleEyedropper: () => void;
  gifLoaded: boolean;
  onPreviewUpdate: (entries: ColorEntry[] | null) => void;
}

export function ColorEntryList({
  entries, gifColors, colorsLoading, tolerance, onToleranceChange,
  onRemove, onUpdate, addPanelOpen, onToggleAddPanel,
  pendingColor, onPendingColorChange, onConfirmAdd,
  eyedropperActive, onToggleEyedropper, gifLoaded,
  onPreviewUpdate,
}: ColorEntryListProps) {

  function handleEntryLiveState(liveEntry: ColorEntry | null) {
    if (liveEntry === null) {
      onPreviewUpdate(null);
    } else {
      onPreviewUpdate(entries.map(e => e.id === liveEntry.id ? liveEntry : e));
    }
  }

  function handleAddLivePreview(replHex: string, transparent: boolean, tolerance: number) {
    const virtualEntry: ColorEntry = { id: "__add__", sourceHex: pendingColor, replHex, transparent, tolerance };
    onPreviewUpdate([...entries, virtualEntry]);
  }

  function handleConfirm(replHex: string, transparent: boolean, tol: number) {
    onConfirmAdd(replHex, transparent, tol);
    onPreviewUpdate(null);
  }

  function handleCancel() {
    onToggleAddPanel();
    onPreviewUpdate(null);
  }

  return (
    <div className="colors-card">
      <div className="card-head">
        <span className="card-title">
          {t("colors_title")}
          <span className="count">· {entries.length}</span>
        </span>
        <button className="add-btn" onClick={onToggleAddPanel}>
          <PlusIcon /> {t("add_color")}
        </button>
      </div>

      <div className="mapping-list">
        {entries.length === 0 && !addPanelOpen && (
          <div className="empty-state">{t("no_colors")}</div>
        )}

        {entries.map(entry => (
          <EntryRow
            key={entry.id}
            entry={entry}
            onRemove={() => onRemove(entry.id)}
            onUpdate={changes => onUpdate(entry.id, changes)}
            onLiveState={handleEntryLiveState}
            gifColors={gifColors}
            colorsLoading={colorsLoading}
            gifTolerance={tolerance}
            onGifToleranceChange={onToleranceChange}
            eyedropperActive={eyedropperActive}
            onToggleEyedropper={onToggleEyedropper}
            gifLoaded={gifLoaded}
            pendingColor={pendingColor}
            onPendingColorChange={onPendingColorChange}
          />
        ))}

        {addPanelOpen && (
          <AddPanel
            pendingColor={pendingColor}
            onPendingColorChange={onPendingColorChange}
            gifColors={gifColors}
            colorsLoading={colorsLoading}
            gifTolerance={tolerance}
            onGifToleranceChange={onToleranceChange}
            eyedropperActive={eyedropperActive}
            onToggleEyedropper={onToggleEyedropper}
            gifLoaded={gifLoaded}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onLivePreview={handleAddLivePreview}
          />
        )}
      </div>
    </div>
  );
}
