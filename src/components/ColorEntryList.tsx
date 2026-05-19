import { useRef, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Center,
  ColorPicker,
  Group,
  Loader,
  Paper,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";

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
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function isValidHex(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

// ─── Checkerboard swatch ──────────────────────────────────────────────────────
function CheckerSwatch({ size = 22 }: { size?: number }) {
  return (
    <Box style={{
      width: size, height: size, borderRadius: 3, flexShrink: 0,
      background: "repeating-conic-gradient(#888 0% 25%, #555 0% 50%) 0 0 / 8px 8px",
      border: "1px solid var(--mantine-color-gray-6)",
    }} />
  );
}

// ─── Solid colour swatch ──────────────────────────────────────────────────────
function ColorSwatch({ hex, size = 22 }: { hex: string; size?: number }) {
  return (
    <Box style={{
      width: size, height: size, borderRadius: 3, backgroundColor: hex, flexShrink: 0,
      border: "1px solid var(--mantine-color-gray-6)",
    }} />
  );
}

// ─── Simple hex text input ────────────────────────────────────────────────────
function HexInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [raw, setRaw] = useState(value);
  if (isValidHex(value) && value !== raw) setRaw(value);
  return (
    <TextInput
      value={raw}
      onChange={(e) => {
        const v = e.currentTarget.value;
        setRaw(v);
        if (isValidHex(v)) onChange(v);
      }}
      leftSection={<ColorSwatch hex={isValidHex(raw) ? raw : "#000000"} size={16} />}
      styles={{ input: { fontFamily: "monospace" } }}
      placeholder="#rrggbb"
      error={raw.length > 0 && !isValidHex(raw) ? "Invalid hex" : undefined}
    />
  );
}

// ─── Swatch row ───────────────────────────────────────────────────────────────
function SwatchRow({ colors, active, onPick }: {
  colors: string[];
  active?: string;
  onPick: (hex: string) => void;
}) {
  if (colors.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
      {colors.map((hex, i) => (
        <Tooltip key={i} label={hex} withArrow openDelay={300}>
          <Box
            onClick={() => onPick(hex)}
            style={{
              width: 20, height: 20, borderRadius: 3,
              backgroundColor: hex, cursor: "pointer",
              border: active === hex
                ? "2px solid var(--mantine-color-blue-4)"
                : "1px solid var(--mantine-color-gray-6)",
            }}
          />
        </Tooltip>
      ))}
    </div>
  );
}

// ─── Shared two-step editor ───────────────────────────────────────────────────
// Used by both the Add panel (initialStep=1) and EntryRow edit (initialStep=2).

interface TwoStepFlowProps {
  initialStep?: 1 | 2;
  // Step 1 — source colour
  sourceHex: string;
  onSourceHexChange: (hex: string) => void;
  gifColors: RgbColor[];
  colorsLoading: boolean;
  gifTolerance: number;
  onGifToleranceChange: (v: number) => void;
  eyedropperActive: boolean;
  onToggleEyedropper: () => void;
  gifLoaded: boolean;
  // Step 2 — replacement
  replHexa: string;                             // 8-char "#rrggbbaa"
  onReplHexaChange: (v: string) => void;
  transparent: boolean;
  onTransparentChange: (v: boolean) => void;
  sliderTol: number;
  onSliderTolChange: (v: number) => void;
  onSliderTolCommit: (v: number) => void;
  swatches: string[];
  // Actions
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  // hide the source→replacement header in step 2 (when the card already shows it)
  hideStep2Header?: boolean;
}

function TwoStepFlow({
  initialStep = 1,
  sourceHex, onSourceHexChange,
  gifColors, colorsLoading, gifTolerance, onGifToleranceChange,
  eyedropperActive, onToggleEyedropper, gifLoaded,
  replHexa, onReplHexaChange, transparent, onTransparentChange,
  sliderTol, onSliderTolChange, onSliderTolCommit,
  swatches,
  onConfirm, onCancel, confirmLabel = "Confirm",
  hideStep2Header = false,
}: TwoStepFlowProps) {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [gifSliderVal, setGifSliderVal] = useState(gifTolerance);
  const replHexRgb = replHexa.slice(0, 7);

  function handleBack() {
    setStep(1);
  }

  if (step === 1) {
    return (
      <Stack gap="sm">
        <Tooltip label={gifLoaded ? "Click on the GIF to pick a color" : "Open a GIF first"} withArrow>
          <Button
            size="xs"
            variant={eyedropperActive ? "filled" : "light"}
            color={eyedropperActive ? "blue" : "gray"}
            disabled={!gifLoaded}
            onClick={onToggleEyedropper}
            leftSection={<span style={{ fontSize: 13 }}>🔍</span>}
          >
            Pick from GIF
          </Button>
        </Tooltip>

        {(gifColors.length > 0 || colorsLoading) && (
          <Stack gap={4}>
            <Group justify="space-between" align="center">
              <Text size="xs" c="dimmed">
                Colors in GIF{!colorsLoading && ` — ${gifColors.length} shown`}
              </Text>
              <Group gap="xs" align="center">
                <Text size="xs" c="dimmed">Tolerance</Text>
                <Slider
                  min={30} max={100}
                  value={gifSliderVal}
                  onChange={setGifSliderVal}
                  onChangeEnd={(v) => { setGifSliderVal(v); onGifToleranceChange(v); }}
                  style={{ width: 100 }}
                  size="xs"
                  label={(v) => v}
                />
                <Text size="xs" ff="monospace" c="dimmed" style={{ minWidth: 24 }}>{gifSliderVal}</Text>
              </Group>
            </Group>

            {colorsLoading ? (
              <Center py="sm"><Loader size="sm" /></Center>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {gifColors.map((c, i) => {
                  const hex = rgbToHex(c);
                  return (
                    <Tooltip key={i} label={hex} withArrow openDelay={300}>
                      <Box
                        onClick={() => onSourceHexChange(hex)}
                        style={{
                          width: 20, height: 20, borderRadius: 3,
                          backgroundColor: hex, cursor: "pointer",
                          border: sourceHex === hex
                            ? "2px solid var(--mantine-color-blue-4)"
                            : "1px solid var(--mantine-color-gray-6)",
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </Stack>
        )}

        <HexInput value={sourceHex} onChange={onSourceHexChange} />

        <Group gap="xs">
          <Button size="xs" onClick={() => setStep(2)} style={{ flex: 1 }}>Next →</Button>
          <Button size="xs" variant="subtle" color="gray" onClick={onCancel} style={{ flex: 1 }}>Cancel</Button>
        </Group>
      </Stack>
    );
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────
  return (
    <Stack gap="sm">
      {/* source → replacement header (hidden when the card summary already shows it) */}
      {!hideStep2Header && (
        <Group gap="xs" align="center">
          <ColorSwatch hex={sourceHex} size={16} />
          <Text size="xs" ff="monospace" c="dimmed">{sourceHex}</Text>
          <Text size="sm" c="dimmed">→</Text>
          {transparent ? <CheckerSwatch size={16} /> : <ColorSwatch hex={replHexRgb} size={16} />}
          <Text size="xs" ff="monospace" c="dimmed">{transparent ? "transparent" : replHexRgb}</Text>
        </Group>
      )}

      <Switch
        label="Make transparent"
        size="sm"
        checked={transparent}
        onChange={(e) => onTransparentChange(e.currentTarget.checked)}
      />

      {!transparent && (
        <Stack gap="xs">
          <ColorPicker
            format="hexa"
            value={replHexa}
            onChange={onReplHexaChange}
            fullWidth
          />
          <HexInput
            value={replHexRgb}
            onChange={(hex) => onReplHexaChange(hex + replHexa.slice(7))}
          />
          <SwatchRow
            colors={swatches}
            active={replHexRgb}
            onPick={(hex) => onReplHexaChange(hex + replHexa.slice(7))}
          />
        </Stack>
      )}

      {/* Tolerance slider */}
      <Stack gap={4}>
        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">Tolerance</Text>
          <Text size="xs" ff="monospace" c="dimmed" style={{ minWidth: 24 }}>{sliderTol}</Text>
        </Group>
        <Slider
          min={0} max={100} size="xs"
          value={sliderTol}
          onChange={onSliderTolChange}
          onChangeEnd={onSliderTolCommit}
        />
      </Stack>

      <Group gap="xs">
        <Button size="xs" variant="subtle" color="gray" onClick={handleBack}>← Back</Button>
        <Button size="xs" variant="light" onClick={onConfirm} style={{ flex: 1 }}>{confirmLabel}</Button>
        <Button size="xs" variant="subtle" color="gray" onClick={onCancel}>Cancel</Button>
      </Group>
    </Stack>
  );
}

// ─── Single entry card ────────────────────────────────────────────────────────
interface EntryRowProps {
  entry: ColorEntry;
  onRemove: () => void;
  onUpdate: (changes: Partial<Omit<ColorEntry, "id">>) => void;
  swatches: string[];
  onLiveState?: (entry: ColorEntry) => void;
  // passed through to TwoStepFlow step 1
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
  entry, onRemove, onUpdate, swatches, onLiveState,
  gifColors, colorsLoading, gifTolerance, onGifToleranceChange,
  eyedropperActive, onToggleEyedropper, gifLoaded,
  pendingColor, onPendingColorChange,
}: EntryRowProps) {
  const [open, setOpen] = useState(false);
  const [localReplHexa, setLocalReplHexa] = useState(entry.replHex + "ff");
  const localReplHexaRef = useRef(entry.replHex + "ff");
  const [localTransparent, setLocalTransparent] = useState(entry.transparent);
  const [localSliderTol, setLocalSliderTol] = useState(entry.tolerance);
  const [localTolerance, setLocalTolerance] = useState(entry.tolerance);
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fireLiveState(overrides?: Partial<Pick<ColorEntry, "replHex" | "transparent" | "tolerance" | "sourceHex">>) {
    onLiveState?.({
      id: entry.id,
      sourceHex: overrides?.sourceHex ?? pendingColor,
      replHex: overrides?.replHex ?? localReplHexaRef.current.slice(0, 7),
      transparent: overrides?.transparent ?? localTransparent,
      tolerance: overrides?.tolerance ?? localTolerance,
    });
  }

  function updateLocalReplHexa(v: string) {
    setLocalReplHexa(v);
    localReplHexaRef.current = v;
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(() => {
      fireLiveState({ replHex: v.slice(0, 7) });
    }, 300);
  }

  function handleToggle() {
    if (open) {
      setOpen(false);
    } else {
      const hexa = entry.replHex + "ff";
      setLocalReplHexa(hexa);
      localReplHexaRef.current = hexa;
      setLocalTransparent(entry.transparent);
      setLocalSliderTol(entry.tolerance);
      setLocalTolerance(entry.tolerance);
      onPendingColorChange(entry.sourceHex);
      setOpen(true);
    }
  }

  function handleDone() {
    onUpdate({
      sourceHex: pendingColor,
      replHex: localReplHexaRef.current.slice(0, 7),
      transparent: localTransparent,
      tolerance: localTolerance,
    });
    setOpen(false);
  }

  function handleCancel() {
    setOpen(false);
  }

  function handleTransparentChange(v: boolean) {
    setLocalTransparent(v);
    fireLiveState({ transparent: v });
  }

  function handleSliderTolCommit(v: number) {
    setLocalSliderTol(v);
    setLocalTolerance(v);
    fireLiveState({ tolerance: v });
  }

  return (
    <Paper withBorder p="sm" radius="sm">
      {/* Summary row — always visible, click to expand/collapse */}
      <Group
        gap="xs"
        align="center"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={handleToggle}
      >
        <ColorSwatch hex={entry.sourceHex} />
        <Text size="xs" ff="monospace" c="dimmed" style={{ minWidth: 58 }}>{entry.sourceHex}</Text>
        <Text size="sm" c="dimmed">→</Text>
        {entry.transparent ? <CheckerSwatch /> : <ColorSwatch hex={entry.replHex} />}
        <Text size="xs" ff="monospace" c="dimmed" style={{ flex: 1 }}>
          {entry.transparent ? "transparent" : entry.replHex}
        </Text>
        <ActionIcon
          variant="subtle" color="red" size="sm"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove"
        >
          ×
        </ActionIcon>
      </Group>

      {/* Expanded editor — no inner border, part of the same card */}
      {open && (
        <Box pt="sm">
          <TwoStepFlow
            initialStep={2}
            sourceHex={pendingColor}
            onSourceHexChange={onPendingColorChange}
            gifColors={gifColors}
            colorsLoading={colorsLoading}
            gifTolerance={gifTolerance}
            onGifToleranceChange={onGifToleranceChange}
            eyedropperActive={eyedropperActive}
            onToggleEyedropper={onToggleEyedropper}
            gifLoaded={gifLoaded}
            replHexa={localReplHexa}
            onReplHexaChange={updateLocalReplHexa}
            transparent={localTransparent}
            onTransparentChange={handleTransparentChange}
            sliderTol={localSliderTol}
            onSliderTolChange={setLocalSliderTol}
            onSliderTolCommit={handleSliderTolCommit}
            swatches={swatches}
            onConfirm={handleDone}
            onCancel={handleCancel}
            confirmLabel="Done"
            hideStep2Header
          />
        </Box>
      )}
    </Paper>
  );
}

// ─── Main list component ──────────────────────────────────────────────────────
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
  previewModeActive: boolean;
  onPreviewUpdate: (entries: ColorEntry[]) => void;
}

export function ColorEntryList({
  entries, gifColors, colorsLoading, tolerance, onToleranceChange,
  onRemove, onUpdate, addPanelOpen, onToggleAddPanel,
  pendingColor, onPendingColorChange, onConfirmAdd,
  eyedropperActive, onToggleEyedropper, gifLoaded,
  previewModeActive, onPreviewUpdate,
}: ColorEntryListProps) {
  // Step 2 state for the Add panel (lives here to survive TwoStepFlow remounts)
  const [addReplHexa, setAddReplHexa] = useState("#ff0000ff");
  const addReplHexaRef = useRef("#ff0000ff");
  const [addTransparent, setAddTransparent] = useState(false);
  const [addSliderTol, setAddSliderTol] = useState(20);
  const [addTolerance, setAddTolerance] = useState(20);
  const addColorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleEntryLiveState(liveEntry: ColorEntry) {
    if (!previewModeActive) return;
    onPreviewUpdate(entries.map((e) => e.id === liveEntry.id ? liveEntry : e));
  }

  function fireAddLiveState(overrides?: { replHex?: string; transparent?: boolean; tolerance?: number }) {
    if (!previewModeActive || !addPanelOpen) return;
    const virtualEntry: ColorEntry = {
      id: "__add__",
      sourceHex: pendingColor,
      replHex: overrides?.replHex ?? addReplHexaRef.current.slice(0, 7),
      transparent: overrides?.transparent ?? addTransparent,
      tolerance: overrides?.tolerance ?? addTolerance,
    };
    onPreviewUpdate([...entries, virtualEntry]);
  }

  const usedColors = [
    ...new Set(entries.filter((e) => !e.transparent).map((e) => e.replHex)),
  ];

  function resetAddState() {
    const init = "#ff0000ff";
    setAddReplHexa(init);
    addReplHexaRef.current = init;
    setAddTransparent(false);
    setAddSliderTol(20);
    setAddTolerance(20);
  }

  function handleAddConfirm() {
    onConfirmAdd(addReplHexaRef.current.slice(0, 7), addTransparent, addTolerance);
    resetAddState();
  }

  function handleAddCancel() {
    resetAddState();
    onToggleAddPanel();
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Text fw={600} size="sm">Colors to change</Text>

        {entries.length === 0 && !addPanelOpen && (
          <Text size="sm" c="dimmed">No colors added yet. Click below to add one.</Text>
        )}

        {entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            swatches={usedColors}
            onRemove={() => onRemove(entry.id)}
            onUpdate={(changes) => onUpdate(entry.id, changes)}
            gifColors={gifColors}
            colorsLoading={colorsLoading}
            gifTolerance={tolerance}
            onGifToleranceChange={onToleranceChange}
            eyedropperActive={eyedropperActive}
            onToggleEyedropper={onToggleEyedropper}
            gifLoaded={gifLoaded}
            pendingColor={pendingColor}
            onPendingColorChange={onPendingColorChange}
            onLiveState={handleEntryLiveState}
          />
        ))}

        {addPanelOpen ? (
          <Paper withBorder p="sm" radius="sm">
            <TwoStepFlow
              initialStep={1}
              sourceHex={pendingColor}
              onSourceHexChange={onPendingColorChange}
              gifColors={gifColors}
              colorsLoading={colorsLoading}
              gifTolerance={tolerance}
              onGifToleranceChange={onToleranceChange}
              eyedropperActive={eyedropperActive}
              onToggleEyedropper={onToggleEyedropper}
              gifLoaded={gifLoaded}
              replHexa={addReplHexa}
              onReplHexaChange={(v) => {
                setAddReplHexa(v);
                addReplHexaRef.current = v;
                if (addColorDebounceRef.current) clearTimeout(addColorDebounceRef.current);
                addColorDebounceRef.current = setTimeout(() => fireAddLiveState({ replHex: v.slice(0, 7) }), 300);
              }}
              transparent={addTransparent}
              onTransparentChange={(v) => { setAddTransparent(v); fireAddLiveState({ transparent: v }); }}
              sliderTol={addSliderTol}
              onSliderTolChange={setAddSliderTol}
              onSliderTolCommit={(v) => {
                setAddSliderTol(v);
                setAddTolerance(v);
                fireAddLiveState({ tolerance: v });
              }}
              swatches={usedColors}
              onConfirm={handleAddConfirm}
              onCancel={handleAddCancel}
              confirmLabel="Add"
            />
          </Paper>
        ) : (
          <Button
            variant="light" color="gray" size="xs"
            onClick={onToggleAddPanel}
            leftSection={<span style={{ fontWeight: 700 }}>+</span>}
          >
            Add color
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
