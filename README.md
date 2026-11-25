# 🎨 GIF Color Changer

<div align="center">

[demo_gif_recolor.webm](https://github.com/user-attachments/assets/c8124ab1-d9d4-4231-9568-8a0d832ce041)

</div>

---

## Overview 📋

**GIF Color Changer** is a lightweight desktop app for replacing colors in animated GIFs — precise, fast, and lossless.
Built with [React](https://reactjs.org/) and [Tauri v2](https://v2.tauri.app/), all processing runs natively in Rust, so nothing ever leaves your machine.

---

## Features ✨

- 🖼️ **Live Preview** — see changes frame-by-frame before exporting
- 🎯 **Tolerance-based matching** — similar shades are automatically included
- 🔲 **Transparency support** — replace any color with full transparency
- 🪄 **Border expansion** — fills pixels around replaced regions for clean edges
- 📦 **Batch processing** — apply the same rules to multiple GIFs at once
- 💾 **Export / import rules** — save and reuse color rules as `.json` files
- 🌍 **Multilingual** — English, German, French, Spanish
- 🖱️ **Eyedropper** — pick colors directly by clicking on the GIF
- 🗂️ **Drag & Drop** — just drop GIFs into the app

---

## Interface 🖥️

The app has three sections, accessible via the sidebar:

- 🏠 **Home** — open a GIF, define color rules, apply changes & save
- 📦 **Batch** — process multiple GIFs with the same ruleset at once
- ⚙️ **Settings** — language, live-preview default, export folder, filename schema, overwrite behavior

---

## How it works ⚙️

All GIF processing runs entirely in Rust:

1. **Decode** — every frame is composited into a full RGBA canvas (respecting disposal methods)
2. **Transform** — pixel-accurate color matching using squared Euclidean distance (`dr² + dg² + db²`)
3. **Quantize** — NeuQuant reduces each frame to max. 256 colors (Rayon-parallelized)
4. **Encode** — re-encoded as GIF with correct delays and loop flag

### Tolerance slider

The slider runs from **0–100**, but the actual threshold is `tolerance²`. Low values = tight selection, high values = wide range of similar shades.

---

## Installation 💻

### Windows 🪟
1. Download the latest `.exe`/`.msi` installer from the [Releases](https://github.com/Dav1d-Fn/gif-color-changer/releases) page.
2. Run the installer and follow the on-screen instructions.

### macOS 🍎
1. Download the `.dmg` from the [Releases](https://github.com/Dav1d-Fn/gif-color-changer/releases) page (`aarch64` for Apple Silicon, `x86_64` for Intel).
2. Open it and drag the app into your Applications folder.

### Linux 🐧
1. Download the `.AppImage` or `.deb` from the [Releases](https://github.com/Dav1d-Fn/gif-color-changer/releases) page.
2. Make the AppImage executable (`chmod +x`) and run it, or install the `.deb` with your package manager.

---

## Build & Development 🚀

**Prerequisites:** Node.js, Rust, Tauri CLI v2

```bash
# Dev mode (Vite + Tauri together)
npm run tauri dev

# Build release binary
npm run tauri build

# Type-check frontend only
npx tsc --noEmit

# Check Rust without building
cd src-tauri && cargo check
```

---

## Tech Stack 🛠️

- **UI** — React 18 + TypeScript + Vite
- **Components** — Mantine v7
- **Desktop shell** — Tauri v2
- **GIF processing** — Rust (`gif`, `color_quant`, `rayon`)
- **Serialization** — `serde` / `serde_json`

---

## Filename Schema (Batch) 📁

The output filename for batch exports can be customized using tokens:

- `{name}` — original filename without `.gif`
- `{date}` — date in `YYYY-MM-DD` format
- `{index}` — position in the queue (1-based)

Example: `{name}_recolored_{date}.gif` → `animation_recolored_2026-05-25.gif`

---

## Donations 💖

If you enjoy using GIF Color Changer and want to support its development, you can buy me a coffee:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/davidfn)

---

## Feedback & Contributions

Found a bug or have a feature idea? Feel free to [open an issue](https://github.com/Dav1d-Fn/gif-color-changer/issues) or reach out!

---

## License 📄

[GPL-3.0](LICENSE) — if you build something with this code, your project has to stay open source too.
