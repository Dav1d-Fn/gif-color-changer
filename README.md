# 🎨 GIF Color Changer

> Ein leichtgewichtiger Desktop-App zum Ersetzen von Farben in animierten GIFs — präzise, schnell und ohne Qualitätsverlust.

<br>

## 🎬 Demo

<!-- Demo-Video hier einfügen -->

<br>

---

## ✨ Features

- 🖼️ **Live-Vorschau** — sieh Änderungen frame-by-frame bevor du exportierst
- 🎯 **Toleranz-basiertes Matching** — ähnliche Farbtöne werden automatisch miterfasst
- 🔲 **Transparenz-Support** — ersetze Farben durch vollständige Transparenz
- 🪄 **Kanten-Expansion** — border-Effekt füllt Pixel rund um ersetzte Bereiche auf
- 📦 **Batch-Verarbeitung** — mehrere GIFs gleichzeitig mit gleichen Regeln bearbeiten
- 💾 **Regeln exportieren/importieren** — Farbregeln als `.json` speichern und wiederverwenden
- 🌍 **Mehrsprachig** — Deutsch, Englisch, Französisch, Spanisch
- 🖱️ **Eyedropper** — Farben direkt per Klick aus dem GIF aufnehmen
- 🗂️ **Drag & Drop** — GIFs einfach in die App ziehen

---

## 🖥️ Oberfläche

Die App hat drei Bereiche, erreichbar über die Seitenleiste:

| Tab | Funktion |
|-----|----------|
| 🏠 **Home** | GIF öffnen, Farbregeln definieren, Änderungen anwenden & speichern |
| 📦 **Batch** | Mehrere GIFs mit denselben Regeln auf einmal verarbeiten |
| ⚙️ **Settings** | Sprache, Standard-Toleranz, Export-Ordner, Datei-Schema |

---

## ⚙️ Wie es funktioniert

GIF-Verarbeitung läuft vollständig in Rust:

1. **Decode** — alle Frames werden zu vollen RGBA-Canvases aufgelöst (inkl. Disposal-Methoden)
2. **Transform** — Pixel-genaues Farb-Matching mit quadratischer Euklidischer Distanz (`dr² + dg² + db²`)
3. **Quantize** — NeuQuant-Algorithmus reduziert auf max. 256 Farben pro Frame (Rayon-parallelisiert)
4. **Encode** — Re-Encoding als GIF mit korrekten Delays und Loop-Flag

### Toleranz-Slider

Der Slider läuft von **0–100**, der tatsächliche Schwellwert ist `toleranz²`. Das heißt: kleine Slider-Werte = enge Auswahl, große Werte = weiter Bereich ähnlicher Farbtöne.

---

## 🚀 Build & Development

**Voraussetzungen:** Node.js, Rust, Tauri CLI v2

```bash
# Dev-Modus (Vite + Tauri gleichzeitig)
npm run tauri dev

# Release-Binary bauen
npm run tauri build

# Nur Frontend type-checken
npx tsc --noEmit

# Rust prüfen ohne Build
cd src-tauri && cargo check
```

---

## 🛠️ Tech Stack

| Bereich | Technologie |
|---------|-------------|
| UI | React 18 + TypeScript + Vite |
| Komponenten | Mantine v7 |
| Desktop-Shell | Tauri v2 |
| GIF-Verarbeitung | Rust (`gif`, `color_quant`, `rayon`) |
| Serialisierung | `serde` / `serde_json` |

---

## 📁 Datei-Schema (Batch)

Beim Batch-Export lässt sich der Dateiname per Schema konfigurieren:

| Token | Bedeutung |
|-------|-----------|
| `{name}` | Originaldateiname ohne `.gif` |
| `{date}` | Datum im Format `YYYY-MM-DD` |
| `{index}` | Position in der Warteschlange (1-basiert) |

Beispiel: `{name}_recolored_{date}.gif` → `animation_recolored_2026-05-25.gif`

---

## 📄 Lizenz

MIT
