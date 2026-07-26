# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Tauri v2 desktop app that lets users replace colors in animated GIFs. The frontend is React + TypeScript (Vite), the backend is Rust. All GIF processing happens in Rust; the frontend only handles UI state and file I/O via Tauri plugins.

## Commands

```bash
# Run in dev mode (starts both Vite dev server and Tauri)
npm run tauri dev

# Build release binary
npm run tauri build

# TypeScript type-check + Vite build (frontend only)
npm run build

# Rust: check without building
cd src-tauri && cargo check

# Rust: run tests
cd src-tauri && cargo test
```

There are no lint scripts configured. Use `tsc --noEmit` for frontend type checking.

## Architecture

**Frontend (`src/`)** — React single-page app with sidebar navigation (Home / Batch / Settings tabs). All tab panes are always mounted; visibility is toggled via CSS class.

- `App.tsx` — all app state lives here (loaded GIF, color entries, progress, settings). Calls Tauri commands via `invoke`. Settings are persisted to `localStorage`.
- `components/GifPreview.tsx` — renders a GIF as `<img>` with optional eyedropper mode; reads pixel colors from a hidden `<canvas>` on click.
- `components/ColorEntryList.tsx` — manages the list of color-replacement entries. Each entry maps one or more source colors (`sourceHexes: string[]`) to a replacement color or transparency, with a tolerance and optional border expansion.
- `components/BatchTab.tsx` — accepts multiple GIFs (via file picker or native drag-drop via `tauri://drag-drop`), applies the current rule set to all of them sequentially, writes output using a configurable filename schema.
- `components/SettingsTab.tsx` — UI for persisted preferences (language, live-preview toggle, export folder, file schema, overwrite behavior).
- `src/i18n.ts` — thin i18n system supporting de / en / fr / es. Keys are looked up from a static dictionary; interpolation uses `{key}` placeholders.
- `src/utils.ts` — `hexToRgb`, `base64ToUint8Array`, and the `ProgressEvent` type shared between Home and Batch tabs.

**Backend (`src-tauri/src/lib.rs`)** — all commands operate on fully-composited RGBA frames (not palette indices):

| Command | Description |
|---|---|
| `apply_color_changes(file_path, mappings, on_progress)` | Re-encodes the full GIF with color transforms applied. Reports `Decode / Transform { frame, total } / Encode { frame, total }` events via a Tauri `Channel`. Parallelised with Rayon. |
| `apply_frame(file_path, frame_index, mappings)` | Applies transforms to a single frame and returns a single-frame GIF — used for live-preview. |
| `get_gif_info(file_path)` | Returns `{ width, height, frameCount }`. |
| `preview_affected(file_path, target_r/g/b, tolerance)` | Highlights matching pixels with magenta across all frames. |
| `preview_frame(file_path, frame_index, target_r/g/b, tolerance)` | Same as `preview_affected` but for one frame. |
| `open_path(path)` | Opens a folder in the OS file manager (xdg-open / open / explorer). |
| `debug_roundtrip` / `debug_export_frames` | Dev-only debugging commands. |

**Processing pipeline (Rust):**
1. `decode_to_rgba_frames` — decodes GIF respecting disposal methods (Background / Previous / None) and composites every frame onto a full-screen RGBA canvas.
2. `transform_frame` — two passes: (1) per-pixel tolerance matching, transparent rules first; (2) if any mapping has `border_pct > 0`, expands each replaced region outward by that radius.
3. `rgba_to_gif_frame` — NeuQuant quantization (up to 255 opaque colors + 1 reserved transparent slot); result is a `gif::Frame<'static>`.
4. Frames are quantized in parallel (`par_iter`) then written sequentially to `GifEncoder` (which is not `Send`).

All commands return `data:image/gif;base64,...`.

**Data flow:**
1. User opens a GIF → frontend reads bytes via `tauri-plugin-fs`, encodes to base64 for display, passes file path to Rust for `get_gif_info`.
2. User builds a list of `ColorEntry` objects (`{ id, sourceHexes, replHex, transparent, tolerance, border }`) in the frontend.
3. Live-preview mode invokes `apply_frame` on the current frame index whenever entries change.
4. "Apply Changes" maps entries to `ColorMapping[]` and invokes `apply_color_changes` with a progress `Channel`; the resulting base64 is shown in the Modified panel.
5. "Save" (Home) writes modified base64 to disk; Batch tab writes each processed file to the configured export folder using the filename schema (`{name}`, `{date}`, `{index}` tokens).

## Key details

- Color tolerance uses squared Euclidean distance in RGB (`dr² + dg² + db²`). The slider range is 0–100; the actual threshold is `tolerance²`. A tolerance of 0 still returns colors (it matches exactly).
- `ColorEntry.border` is 0–50, representing 0.0%–5.0% of `min(width, height)` in pixels — converted as `border * 0.1` when sent to Rust as `border_pct`.
- `pendingColors` in `App.tsx` is a `string[]` of hex values being staged for the Add panel; the eyedropper and the color palette both toggle entries in this array.
- Mantine `ColorPicker` produces 8-char `#rrggbbaa` strings; the alpha byte is stripped to 6-char hex before sending to Rust.
- Rules can be exported/imported as `.json` files with `format: "gifrecolor.rules"` and `version: 1`.
- No tests exist yet for the Rust commands.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
