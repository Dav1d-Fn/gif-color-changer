# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Tauri v2 desktop app that lets users replace colors in animated GIFs. The frontend is React + TypeScript (Vite), and the backend is Rust. All GIF processing happens in Rust; the frontend only handles UI state and file I/O via Tauri plugins.

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

**Frontend (`src/`)** — React single-page app, no routing.
- `App.tsx` — all app state lives here. Owns the loaded GIF path/data, color entries, loading flags, and calls Tauri commands via `invoke`.
- `components/GifPreview.tsx` — renders a GIF as `<img>` with an optional eyedropper mode; uses a hidden `<canvas>` to read pixel colors on click.
- `components/ColorEntryList.tsx` — manages the list of color-replacement entries. Contains a shared `TwoStepFlow` component (step 1: pick source color; step 2: pick replacement + tolerance) reused for both adding new entries and editing existing ones.

**Backend (`src-tauri/src/lib.rs`)** — three Tauri commands:
- `extract_gif_colors(file_path, tolerance)` — scans all frame palettes and returns distinct colors (deduplicated by Euclidean distance in RGB space).
- `apply_color_changes(file_path, mappings)` — re-encodes the GIF with per-entry palette rewrites. Handles delta frames (>50% transparent pixels) vs. full frames differently to preserve compositing.
- `preview_affected(file_path, target_r, target_g, target_b, tolerance)` — same as apply but replaces matching palette entries with magenta (#ff00ff) so the user can see the affected area.

All three commands return a `data:image/gif;base64,...` string (or an array of `RgbColor` for extraction). GIF processing operates on palette indices, not individual pixels — matching is done by finding palette entries within a Euclidean distance tolerance, then rewriting those palette slots.

**Data flow:**
1. User opens a GIF → frontend reads bytes via `tauri-plugin-fs`, encodes to base64 for display, passes file path to Rust for color extraction.
2. User builds a list of `ColorEntry` objects (`{ sourceHex, replHex, transparent, tolerance }`) in the frontend.
3. "Apply Changes" serializes entries to `ColorMapping` structs and invokes `apply_color_changes`; result base64 is displayed in the Modified panel.
4. "Save" writes the base64 back to disk via `tauri-plugin-fs`.

## Key details

- Color tolerance uses squared Euclidean distance in RGB (`dr² + dg² + db²`). The slider range is 0–100; the threshold used is `tolerance²`. A tolerance of 0 still matches the single closest palette entry (never returns empty).
- The `pendingColor` state in `App.tsx` is shared between the Add panel and any open EntryRow editor — only one editor should be open at a time.
- `replHexa` in the frontend is an 8-character `#rrggbbaa` string (Mantine `ColorPicker` format); the alpha byte is stripped to 6-char hex before sending to Rust.
- No tests exist yet for the Rust commands.
