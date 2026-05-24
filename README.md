# 🎨 GIF Color Changer

> A lightweight desktop app for replacing colors in animated GIFs — precise, fast, and lossless.

<br>

## 🎬 Demo

<!-- Insert demo video here -->

<br>

---

## ✨ Features

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

## 🖥️ Interface

The app has three sections, accessible via the sidebar:

| Tab | Purpose |
|-----|---------|
| 🏠 **Home** | Open a GIF, define color rules, apply changes & save |
| 📦 **Batch** | Process multiple GIFs with the same ruleset at once |
| ⚙️ **Settings** | Language, default tolerance, export folder, filename schema |

---

## ⚙️ How it works

All GIF processing runs entirely in Rust:

1. **Decode** — every frame is composited into a full RGBA canvas (respecting disposal methods)
2. **Transform** — pixel-accurate color matching using squared Euclidean distance (`dr² + dg² + db²`)
3. **Quantize** — NeuQuant reduces each frame to max. 256 colors (Rayon-parallelized)
4. **Encode** — re-encoded as GIF with correct delays and loop flag

### Tolerance slider

The slider runs from **0–100**, but the actual threshold is `tolerance²`. Low values = tight selection, high values = wide range of similar shades.

---

## 🚀 Build & Development

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

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 18 + TypeScript + Vite |
| Components | Mantine v7 |
| Desktop shell | Tauri v2 |
| GIF processing | Rust (`gif`, `color_quant`, `rayon`) |
| Serialization | `serde` / `serde_json` |

---

## 📁 Filename Schema (Batch)

The output filename for batch exports can be customized using tokens:

| Token | Meaning |
|-------|---------|
| `{name}` | Original filename without `.gif` |
| `{date}` | Date in `YYYY-MM-DD` format |
| `{index}` | Position in the queue (1-based) |

Example: `{name}_recolored_{date}.gif` → `animation_recolored_2026-05-25.gif`

---

## 📄 License

MIT
