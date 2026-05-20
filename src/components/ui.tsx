// Shared UI primitives used by App and ColorEntryList

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}
export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <div
      className={`toggle-wrap${disabled ? " disabled" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div className={`toggle-switch ${checked ? "on" : "off"}`} />
      {label && <span className="toggle-label">{label}</span>}
    </div>
  );
}

interface RangeSliderProps {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  onChangeEnd?: (v: number) => void;
}
export function RangeSlider({ value, min = 0, max = 100, disabled, onChange, onChangeEnd }: RangeSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="range-slider"
      min={min} max={max} value={value}
      disabled={disabled}
      onChange={e => onChange(Number(e.currentTarget.value))}
      onMouseUp={e => onChangeEnd?.(Number((e.target as HTMLInputElement).value))}
      onTouchEnd={e => onChangeEnd?.(Number((e.target as HTMLInputElement).value))}
      style={{ background: `linear-gradient(to right, var(--accent) ${pct}%, var(--bg-elevated) ${pct}%)` }}
    />
  );
}

export function Swatch({ hex, size = 26 }: { hex: string; size?: number }) {
  return (
    <div
      className="swatch"
      style={{ backgroundColor: hex, width: size, height: size }}
    />
  );
}

export function TransparentSwatch({ size = 26 }: { size?: number }) {
  return <div className="swatch transparent" style={{ width: size, height: size }} />;
}
