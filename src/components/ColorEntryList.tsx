import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ColorPicker } from "@mantine/core";
import { Toggle, RangeSlider, Swatch, TransparentSwatch } from "./ui";
import { t } from "../i18n";

export interface ColorEntry {
  id: string;
  sourceHexes: string[];
  replHex: string;
  transparent: boolean;
  tolerance: number;
  border: number; // 0–50 → 0.0%–5.0% of min(width,height)
  unmatte: boolean; // reverse-composite alpha from a known matte color
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

// ── Source Color Step 1 (Chip Tray) ──────────────────────────────────────────
interface SourceColorStep1Props {
  pendingColors: string[];
  onToggle: (hex: string) => void;
  eyedropperActive: boolean;
  onToggleEyedropper: () => void;
  gifLoaded: boolean;
  onCancel: () => void;
  cancelLabel: string;
  onNext: () => void;
}

function SourceColorStep1({
  pendingColors, onToggle,
  eyedropperActive, onToggleEyedropper, gifLoaded,
  onCancel, cancelLabel, onNext,
}: SourceColorStep1Props) {
  const [draftHex, setDraftHex] = useState("#ff0000");
  const [draftError, setDraftError] = useState(false);
  const [flashHex, setFlashHex] = useState<string | null>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    let hex = draftHex.trim();
    if (!hex.startsWith("#")) hex = "#" + hex;
    if (!isValidHex(hex)) { setDraftError(true); return; }
    hex = hex.toLowerCase();
    if (pendingColors.includes(hex)) {
      setFlashHex(hex);
      setTimeout(() => setFlashHex(null), 600);
      return;
    }
    onToggle(hex);
    setDraftError(false);
  }

  return (
    <div className="sc-panel">
      {/* ── Header ── */}
      <div className="sc-head">
        <span className="sc-title">{t("choose_source")}</span>
      </div>

      {/* ── Selected sources tray ── */}
      <div className="sc-section">
        <div className="micro-label">
          {t("selected_sources")}
          {pendingColors.length > 0 && (
            <span className="count-pill">{pendingColors.length}</span>
          )}
        </div>
        <div className={`chip-tray${pendingColors.length > 0 ? " has-items" : ""}`}>
          {pendingColors.length === 0
            ? <span className="tray-empty">{t("no_color_selected_hint")}</span>
            : pendingColors.map(hex => (
                <div key={hex} className={`chip${flashHex === hex ? " chip--flash" : ""}`}>
                  <div className="chip-sw" style={{ backgroundColor: hex }} />
                  <span className="chip-hex">{hex.toUpperCase()}</span>
                  <button className="chip-x" onClick={() => onToggle(hex)}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M2 2l6 6M8 2l-6 6"/>
                    </svg>
                  </button>
                </div>
              ))
          }
        </div>
      </div>

      {/* ── Hex input + pick button ── */}
      <div className="sc-input-row">
        <div className={`hex-row${draftError ? " has-error" : ""}`}>
          <div className="hex-row-preview" style={{ backgroundColor: isValidHex(draftHex) ? draftHex : "#333" }} />
          <input
            ref={draftInputRef}
            className="hex-row-input"
            value={draftHex}
            placeholder="#rrggbb"
            onChange={e => { setDraftHex(e.currentTarget.value); setDraftError(false); }}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
          />
          <button className="hex-row-add" onClick={handleAdd}>
            <span className="add-plus">+</span>
            {t("add")}
          </button>
        </div>
        <button
          className={`pick-btn${eyedropperActive ? " active" : ""}`}
          disabled={!gifLoaded}
          onClick={onToggleEyedropper}
        >
          <EyeIcon />
          {t("pick_from_gif")}
        </button>
      </div>

      {/* ── Footer ── */}
      <div className="sc-foot">
        <button className="sc-btn-cancel" onClick={onCancel}>{cancelLabel}</button>
        <button
          className={`sc-btn-next${pendingColors.length === 0 ? " disabled" : ""}`}
          disabled={pendingColors.length === 0}
          onClick={() => { if (eyedropperActive) onToggleEyedropper(); onNext(); }}
        >
          {t("next")}
        </button>
      </div>
    </div>
  );
}

// ── Hex input ─────────────────────────────────────────────────────────────────
function HexInput({ value, onChange, onAdd }: { value: string; onChange: (h: string) => void; onAdd?: (h: string) => void }) {
  const [raw, setRaw] = useState(value);
  if (isValidHex(value) && value !== raw) setRaw(value);
  const error = raw.length > 0 && !isValidHex(raw);
  return (
    <div className="hex-input-row">
      <div
        className="hex-preview"
        style={{ backgroundColor: isValidHex(raw) ? raw : "#000", ...(onAdd ? { cursor: "pointer" } : {}) }}
        title={onAdd ? t("add_to_selection_tooltip") : undefined}
        onClick={onAdd && isValidHex(raw) ? () => onAdd(raw) : undefined}
      />
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
export interface EntryRowHandle {
  hasUnsavedChanges: () => boolean;
  save: () => void;
  discard: () => void;
}

interface EntryRowProps {
  entry: ColorEntry;
  isEditing: boolean;
  onRequestEdit: () => void;
  onCloseEdit: () => void;
  onRemove: () => void;
  onUpdate: (changes: Partial<Omit<ColorEntry, "id">>) => void;
  onLiveState?: (entry: ColorEntry | null) => void;
  eyedropperActive: boolean;
  onToggleEyedropper: () => void;
  gifLoaded: boolean;
  gifMinDim: number | null;
  pendingColors: string[];
  onTogglePendingColor: (hex: string) => void;
  onSetPendingColors: (hexes: string[]) => void;
}

const EntryRow = forwardRef<EntryRowHandle, EntryRowProps>(function EntryRow({
  entry, isEditing, onRequestEdit, onCloseEdit, onRemove, onUpdate, onLiveState,
  eyedropperActive, onToggleEyedropper, gifLoaded, gifMinDim,
  pendingColors, onTogglePendingColor, onSetPendingColors,
}, ref) {
  function borderLabel(b: number) {
    const pct = (b * 0.1).toFixed(1) + "%";
    if (!gifMinDim) return pct;
    const px = Math.round(b * 0.1 / 100 * gifMinDim);
    return `${pct} (≈${px}px)`;
  }

  const [step, setStep] = useState<1 | 2>(1);
  const [localReplHexa, setLocalReplHexa] = useState(entry.replHex + "ff");
  const localReplHexaRef = useRef(entry.replHex + "ff");
  const [localTransparent, setLocalTransparent] = useState(entry.transparent);
  const [localTol, setLocalTol] = useState(entry.tolerance);
  const [localBorder, setLocalBorder] = useState(entry.border);
  const [localUnmatte, setLocalUnmatte] = useState(entry.unmatte);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When this row transitions into edit mode (controlled by the parent, which
  // ensures only one row is ever in edit mode at a time), sync local editing
  // state from the entry. Done during render (not an effect) so the edit form
  // never flashes stale values from a previous editing session of this row.
  const wasEditingRef = useRef(false);
  if (isEditing && !wasEditingRef.current) {
    setLocalReplHexa(entry.replHex + "ff");
    localReplHexaRef.current = entry.replHex + "ff";
    setLocalTransparent(entry.transparent);
    setLocalTol(entry.tolerance);
    setLocalBorder(entry.border);
    setLocalUnmatte(entry.unmatte);
    setStep(2);
  }
  wasEditingRef.current = isEditing;

  useEffect(() => {
    if (isEditing) onSetPendingColors(entry.sourceHexes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () =>
      localReplHexa.slice(0, 7) !== entry.replHex ||
      localTransparent !== entry.transparent ||
      localTol !== entry.tolerance ||
      localBorder !== entry.border ||
      localUnmatte !== entry.unmatte ||
      JSON.stringify(pendingColors) !== JSON.stringify(entry.sourceHexes),
    save: () => handleDone(),
    discard: () => { onLiveState?.(null); },
  }));

  const replHexRgb = localReplHexa.slice(0, 7);

  function fireLive(overrides?: Partial<Pick<ColorEntry, "replHex"|"transparent"|"tolerance"|"border"|"unmatte">>) {
    onLiveState?.({
      id: entry.id,
      sourceHexes: pendingColors,
      replHex: overrides?.replHex ?? localReplHexaRef.current.slice(0, 7),
      transparent: overrides?.transparent ?? localTransparent,
      tolerance: overrides?.tolerance ?? localTol,
      border: overrides?.border ?? localBorder,
      unmatte: overrides?.unmatte ?? localUnmatte,
    });
  }

  function updateReplHexa(v: string) {
    setLocalReplHexa(v);
    localReplHexaRef.current = v;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fireLive({ replHex: v.slice(0, 7) }), 300);
  }

  function handleDone() {
    onUpdate({
      sourceHexes: pendingColors,
      replHex: localReplHexaRef.current.slice(0, 7),
      transparent: localTransparent,
      tolerance: localTol,
      border: localBorder,
      unmatte: localUnmatte,
    });
    onLiveState?.(null);
  }

  function handleTransparentChange(v: boolean) {
    setLocalTransparent(v);
    if (!v) { setLocalUnmatte(false); fireLive({ transparent: v, unmatte: false }); }
    else fireLive({ transparent: v });
  }

  function handleUnmatteChange(v: boolean) {
    setLocalUnmatte(v);
    fireLive({ unmatte: v });
  }

  if (!isEditing) {
    return (
      <div className="mapping">
        <div className="mapping-row">
          {entry.sourceHexes.map(hex => <Swatch key={hex} hex={hex} />)}
          <span className="hex-label">
            {entry.sourceHexes.length === 1
              ? entry.sourceHexes[0].toUpperCase()
              : t("colors_count", { n: entry.sourceHexes.length })}
          </span>
          <span className="arrow">→</span>
          {entry.transparent ? <TransparentSwatch /> : <Swatch hex={entry.replHex} />}
          <span className="hex-label">{entry.transparent ? t("transparent_label") : entry.replHex.toUpperCase()}</span>
          <span className="row-meta" style={{ marginLeft: 10 }}>{t("tol_prefix")} {entry.tolerance}{entry.border > 0 ? ` · ${(entry.border * 0.1).toFixed(1)}%` : ""}</span>
        </div>
        <div className="mapping-actions">
          <button className="icon-btn" title={t("btn_edit")} onClick={onRequestEdit}><EditIcon /></button>
          <button className="icon-btn danger" title={t("btn_remove")} onClick={onRemove}><TrashIcon /></button>
        </div>
      </div>
    );
  }

  function closeEdit() { onLiveState?.(null); onCloseEdit(); }

  if (step === 1) {
    return (
      <div className="mapping editing">
        <SourceColorStep1
          pendingColors={pendingColors}
          onToggle={onTogglePendingColor}
          eyedropperActive={eyedropperActive}
          onToggleEyedropper={onToggleEyedropper}
          gifLoaded={gifLoaded}
          onCancel={closeEdit}
          cancelLabel={t("back")}
          onNext={() => setStep(2)}
        />
      </div>
    );
  }

  return (
    <div className="mapping editing">
      {/* top mapping row */}
      <div className="edit-mapping-row">
        {pendingColors.map(hex => <Swatch key={hex} hex={hex} />)}
        <span className="hex-label muted" style={{ fontSize: "0.75em" }}>
          {pendingColors.length === 1 ? pendingColors[0].toUpperCase() : t("colors_count", { n: pendingColors.length })}
        </span>
        <span className="arrow">→</span>
        {localTransparent ? <TransparentSwatch /> : <Swatch hex={replHexRgb} />}
        <span className={`hex-label${localTransparent ? " muted" : ""}`}>
          {localTransparent ? t("transparent_label") : replHexRgb.toUpperCase()}
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

        {localTransparent && (
          <div className="option-row" style={{ paddingLeft: 12, borderLeft: "2px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Toggle checked={localUnmatte} onChange={handleUnmatteChange} />
              <span className="option-label">{t("unmatte")}</span>
            </div>
            <span className="option-hint">{t("unmatte_hint")}</span>
          </div>
        )}

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
            <span className="option-hint"> — {localUnmatte ? t("unmatte_tol_hint") : t("tolerance_hint")}</span>
          </div>
          <div className="slider-group">
            <RangeSlider
              value={localTol}
              onChange={setLocalTol}
              onChangeEnd={v => fireLive({ tolerance: v })}
            />
            <span className="slider-num">{localUnmatte ? `${localTol}%` : localTol}</span>
          </div>
        </div>

        <div className="option-row">
          <div>
            <span className="option-label">{t("border")}</span>
            <span className="option-hint"> — {t("border_hint")}</span>
          </div>
          <div className="slider-group">
            <RangeSlider
              value={localBorder}
              min={0} max={50}
              onChange={setLocalBorder}
              onChangeEnd={v => fireLive({ border: v })}
            />
            <span className="slider-num">{borderLabel(localBorder)}</span>
          </div>
        </div>
      </div>

      <div className="edit-actions">
        <button className="btn btn-ghost" onClick={() => setStep(1)}>
          <BackIcon /> {t("back")}
        </button>
        <div className="edit-actions-right">
          <button className="btn btn-ghost" onClick={closeEdit}>{t("cancel")}</button>
          <button className="btn btn-accent" onClick={() => { handleDone(); onCloseEdit(); }}>{t("confirm")}</button>
        </div>
      </div>
    </div>
  );
});

// ── Add panel ─────────────────────────────────────────────────────────────────
export interface AddPanelHandle {
  hasUnsavedChanges: () => boolean;
  save: () => void;
  discard: () => void;
}

interface AddPanelProps {
  pendingColors: string[];
  onTogglePendingColor: (hex: string) => void;
  onSetPendingColors: (hexes: string[]) => void;
  eyedropperActive: boolean;
  onToggleEyedropper: () => void;
  gifLoaded: boolean;
  onConfirm: (replHex: string, transparent: boolean, tolerance: number, border: number, unmatte: boolean) => void;
  onCancel: () => void;
  onLivePreview?: (replHex: string, transparent: boolean, tolerance: number, border: number, unmatte: boolean) => void;
  gifMinDim: number | null;
}

const AddPanel = forwardRef<AddPanelHandle, AddPanelProps>(function AddPanel({
  pendingColors, onTogglePendingColor,
  eyedropperActive, onToggleEyedropper, gifLoaded,
  onConfirm, onCancel, onLivePreview, gifMinDim,
}, ref) {
  const [step, setStep] = useState<1 | 2>(1);
  const [replHexa, setReplHexa] = useState("#ff0000ff");
  const replHexaRef = useRef("#ff0000ff");
  const [transparent, setTransparent] = useState(false);
  const [unmatte, setUnmatte] = useState(false);
  const [tol, setTol] = useState(20);
  const [border, setBorder] = useState(3);
  function borderLabel(b: number) {
    const pct = (b * 0.1).toFixed(1) + "%";
    if (!gifMinDim) return pct;
    const px = Math.round(b * 0.1 / 100 * gifMinDim);
    return `${pct} (≈${px}px)`;
  }
  const liveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any pending debounced live-preview when the panel closes (confirm or cancel),
  // so stale fireLive calls don't overwrite the preview after pendingColors is cleared.
  useEffect(() => () => { if (liveDebounce.current) clearTimeout(liveDebounce.current); }, []);

  const replHexRgb = replHexa.slice(0, 7);

  function fireLive(overrides?: { replHex?: string; transparent?: boolean; tolerance?: number; border?: number; unmatte?: boolean }) {
    const rh  = overrides?.replHex     ?? replHexaRef.current.slice(0, 7);
    const tr  = overrides?.transparent ?? transparent;
    const tl  = overrides?.tolerance   ?? tol;
    const bd  = overrides?.border      ?? border;
    const um  = overrides?.unmatte     ?? unmatte;
    onLivePreview?.(rh, tr, tl, bd, um);
  }

  function updateReplHexa(v: string) {
    setReplHexa(v);
    replHexaRef.current = v;
    if (liveDebounce.current) clearTimeout(liveDebounce.current);
    liveDebounce.current = setTimeout(() => fireLive({ replHex: v.slice(0, 7) }), 300);
  }

  function handleTransparentChange(v: boolean) {
    setTransparent(v);
    if (!v) { setUnmatte(false); fireLive({ transparent: v, unmatte: false }); }
    else fireLive({ transparent: v });
  }

  function handleUnmatteChange(v: boolean) {
    setUnmatte(v);
    fireLive({ unmatte: v });
  }

  function handleTolChange(v: number) { setTol(v); }

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => pendingColors.length > 0,
    save: () => onConfirm(replHexaRef.current.slice(0, 7), transparent, tol, border, unmatte),
    discard: () => {},
  }));

  if (step === 1) {
    return (
      <div className="add-panel">
        <SourceColorStep1
          pendingColors={pendingColors}
          onToggle={onTogglePendingColor}
          eyedropperActive={eyedropperActive}
          onToggleEyedropper={onToggleEyedropper}
          gifLoaded={gifLoaded}
          onCancel={onCancel}
          cancelLabel={t("cancel")}
          onNext={() => { setStep(2); fireLive(); }}
        />
      </div>
    );
  }

  return (
    <div className="add-panel">
      {/* mapping preview row */}
      <div className="edit-mapping-row">
        {pendingColors.map(hex => <Swatch key={hex} hex={hex} />)}
        <span className="hex-label muted" style={{ fontSize: "0.75em" }}>
          {pendingColors.length === 1 ? pendingColors[0].toUpperCase() : t("colors_count", { n: pendingColors.length })}
        </span>
        <span className="arrow">→</span>
        {transparent ? <TransparentSwatch /> : <Swatch hex={replHexRgb} />}
        <span className={`hex-label${transparent ? " muted" : ""}`}>
          {transparent ? t("transparent_label") : replHexRgb.toUpperCase()}
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

        {transparent && (
          <div className="option-row" style={{ paddingLeft: 12, borderLeft: "2px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Toggle checked={unmatte} onChange={handleUnmatteChange} />
              <span className="option-label">{t("unmatte")}</span>
            </div>
            <span className="option-hint">{t("unmatte_hint")}</span>
          </div>
        )}

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
            <span className="option-hint"> — {unmatte ? t("unmatte_tol_hint") : t("tolerance_hint")}</span>
          </div>
          <div className="slider-group">
            <RangeSlider value={tol} onChange={handleTolChange} onChangeEnd={v => fireLive({ tolerance: v })} />
            <span className="slider-num">{unmatte ? `${tol}%` : tol}</span>
          </div>
        </div>

        <div className="option-row">
          <div>
            <span className="option-label">{t("border")}</span>
            <span className="option-hint"> — {t("border_hint")}</span>
          </div>
          <div className="slider-group">
            <RangeSlider value={border} min={0} max={50} onChange={setBorder} onChangeEnd={v => fireLive({ border: v })} />
            <span className="slider-num">{borderLabel(border)}</span>
          </div>
        </div>
      </div>

      <div className="edit-actions">
        <button className="btn btn-ghost" onClick={() => setStep(1)}><BackIcon /> {t("back")}</button>
        <div className="edit-actions-right">
          <button className="btn btn-ghost" onClick={onCancel}>{t("cancel")}</button>
          <button className="btn btn-accent" onClick={() => onConfirm(replHexaRef.current.slice(0, 7), transparent, tol, border, unmatte)}>
            {t("add")}
          </button>
        </div>
      </div>
    </div>
  );
});

// ── ColorEntryList ────────────────────────────────────────────────────────────
interface ColorEntryListProps {
  entries: ColorEntry[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, changes: Partial<Omit<ColorEntry, "id">>) => void;
  addPanelOpen: boolean;
  onOpenAddPanel: () => void;
  onCloseAddPanel: () => void;
  pendingColors: string[];
  onTogglePendingColor: (hex: string) => void;
  onSetPendingColors: (hexes: string[]) => void;
  onConfirmAdd: (replHex: string, transparent: boolean, tolerance: number, border: number, unmatte: boolean) => void;
  eyedropperActive: boolean;
  onToggleEyedropper: () => void;
  gifLoaded: boolean;
  gifMinDim: number | null;
  onPreviewUpdate: (entries: ColorEntry[] | null) => void;
  onImport?: () => void;
  onExport?: () => void;
}

export function ColorEntryList({
  entries,
  onRemove, onUpdate, addPanelOpen, onOpenAddPanel, onCloseAddPanel,
  pendingColors, onTogglePendingColor, onSetPendingColors, onConfirmAdd,
  eyedropperActive, onToggleEyedropper, gifLoaded, gifMinDim,
  onPreviewUpdate, onImport, onExport,
}: ColorEntryListProps) {

  // Only one entry may be in edit mode at a time — both entry edit sessions and
  // the add panel share the global `pendingColors` selection, so letting two of
  // them be "open" simultaneously causes edits made in one to bleed into the other.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [switchTarget, setSwitchTarget] = useState<{ kind: "entry"; id: string } | { kind: "add" } | null>(null);
  const entryRefs = useRef<Record<string, EntryRowHandle | null>>({});
  const addPanelRef = useRef<AddPanelHandle | null>(null);

  function handleEntryLiveState(liveEntry: ColorEntry | null) {
    if (liveEntry === null) {
      onPreviewUpdate(null);
    } else {
      onPreviewUpdate(entries.map(e => e.id === liveEntry.id ? liveEntry : e));
    }
  }

  function handleAddLivePreview(replHex: string, transparent: boolean, tolerance: number, border: number, unmatte: boolean) {
    const virtualEntry: ColorEntry = { id: "__add__", sourceHexes: pendingColors, replHex, transparent, tolerance, border, unmatte };
    onPreviewUpdate([...entries, virtualEntry]);
  }

  function handleConfirm(replHex: string, transparent: boolean, tol: number, border: number, unmatte: boolean) {
    onConfirmAdd(replHex, transparent, tol, border, unmatte);
    onPreviewUpdate(null);
  }

  function closeAddPanel() {
    if (!addPanelOpen) return;
    onCloseAddPanel();
    onSetPendingColors([]);
    onPreviewUpdate(null);
  }

  function openAddPanel() {
    if (addPanelOpen) return;
    onOpenAddPanel();
  }

  function handleCancel() {
    closeAddPanel();
  }

  function closeEditSession() {
    setEditingId(null);
    onSetPendingColors([]);
    onPreviewUpdate(null);
  }

  // Save/discard whichever session (an entry edit or the add panel) is
  // currently open. At most one of `editingId` / `addPanelOpen` is ever true.
  function forceSaveActiveSession() {
    if (editingId) {
      entryRefs.current[editingId]?.save();
      closeEditSession();
    } else if (addPanelOpen) {
      addPanelRef.current?.save();
      closeAddPanel();
    }
  }

  function forceDiscardActiveSession() {
    if (editingId) {
      entryRefs.current[editingId]?.discard();
      closeEditSession();
    } else if (addPanelOpen) {
      addPanelRef.current?.discard();
      closeAddPanel();
    }
  }

  function requestEditEntry(id: string) {
    if (editingId === id) return;
    if (editingId === null) {
      if (addPanelOpen) {
        const dirty = addPanelRef.current?.hasUnsavedChanges() ?? false;
        if (dirty) { setSwitchTarget({ kind: "entry", id }); return; }
        closeAddPanel();
      }
      setEditingId(id);
      return;
    }
    const dirty = entryRefs.current[editingId]?.hasUnsavedChanges() ?? false;
    if (dirty) {
      setSwitchTarget({ kind: "entry", id });
    } else {
      forceDiscardActiveSession();
      setEditingId(id);
    }
  }

  function requestOpenAdd() {
    if (addPanelOpen) { closeAddPanel(); return; }
    if (editingId) {
      const dirty = entryRefs.current[editingId]?.hasUnsavedChanges() ?? false;
      if (dirty) { setSwitchTarget({ kind: "add" }); return; }
      forceDiscardActiveSession();
    }
    openAddPanel();
  }

  function resolveSwitch(action: "save" | "discard" | "cancel") {
    if (!switchTarget) return;
    if (action === "cancel") { setSwitchTarget(null); return; }
    if (action === "save") forceSaveActiveSession(); else forceDiscardActiveSession();
    if (switchTarget.kind === "entry") setEditingId(switchTarget.id);
    else openAddPanel();
    setSwitchTarget(null);
  }

  return (
    <div className="colors-card">
      <div className="card-head">
        <span className="card-title">
          {t("colors_title")}
          <span className="count">· {entries.length}</span>
        </span>
        <div className="card-head-actions">
          <button className="icon-btn" title={t("rules_import_tooltip")} onClick={onImport}>
            <ImportIcon />
          </button>
          <button
            className="icon-btn"
            title={t("rules_export_tooltip")}
            onClick={onExport}
            disabled={entries.length === 0}
          >
            <ExportIcon />
          </button>
          <div className="card-head-divider" />
          <button className="add-btn" onClick={requestOpenAdd}>
            <PlusIcon /> {t("add_color")}
          </button>
        </div>
      </div>

      <div className="mapping-list">
        {entries.length === 0 && !addPanelOpen && (
          <div className="empty-state">{t("no_colors")}</div>
        )}

        {entries.map(entry => (
          <EntryRow
            key={entry.id}
            ref={el => { entryRefs.current[entry.id] = el; }}
            entry={entry}
            isEditing={editingId === entry.id}
            onRequestEdit={() => requestEditEntry(entry.id)}
            onCloseEdit={closeEditSession}
            onRemove={() => onRemove(entry.id)}
            onUpdate={changes => onUpdate(entry.id, changes)}
            onLiveState={handleEntryLiveState}
            eyedropperActive={eyedropperActive}
            onToggleEyedropper={onToggleEyedropper}
            gifLoaded={gifLoaded}
            gifMinDim={gifMinDim}
            pendingColors={pendingColors}
            onTogglePendingColor={onTogglePendingColor}
            onSetPendingColors={onSetPendingColors}
          />
        ))}

        {addPanelOpen && (
          <AddPanel
            ref={addPanelRef}
            pendingColors={pendingColors}
            onTogglePendingColor={onTogglePendingColor}
            onSetPendingColors={onSetPendingColors}
            eyedropperActive={eyedropperActive}
            onToggleEyedropper={onToggleEyedropper}
            gifLoaded={gifLoaded}
            gifMinDim={gifMinDim}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onLivePreview={handleAddLivePreview}
          />
        )}
      </div>

      {switchTarget && (
        <div className="app-loading-overlay" style={{ alignItems: "flex-start", paddingTop: 80 }}>
          <div className="colors-card" style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{t("edit_switch_title")}</div>
            <p className="brand-sub" style={{ marginBottom: 0 }}>{t("edit_switch_body")}</p>
            <div className="edit-actions" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => resolveSwitch("cancel")}>{t("cancel")}</button>
              <div className="edit-actions-right">
                <button className="btn btn-ghost" onClick={() => resolveSwitch("discard")}>{t("edit_switch_discard")}</button>
                <button className="btn btn-accent" onClick={() => resolveSwitch("save")}>{t("edit_switch_save")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
