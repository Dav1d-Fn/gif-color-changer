const de = {
  // status bar
  no_file:          "Keine Datei geöffnet",
  color_singular:   "Farbe",
  color_plural:     "Farben",
  assigned:         "zugewiesen",
  unsaved:          "ungespeichert",
  rule_singular:    "Farbregel",
  rule_plural:      "Farbregeln",
  on_all_frames:    "auf alle {n} Frames",
  apply_hint:       "Farbregeln auf alle Frames anwenden",

  // titlebar
  minimize:         "Minimieren",
  maximize:         "Maximieren",
  restore:          "Wiederherstellen",
  close:            "Schließen",

  // file pill
  no_file_pill:     "Keine Datei",
  open_other:       "Andere öffnen",

  // preview placeholders
  preview_open:     "GIF öffnen um Vorschau zu sehen",
  preview_apply:    "Änderungen anwenden um Ergebnis zu sehen",

  // controls
  live_preview:     "Live-Preview",

  // apply progress
  decoding:         "Dekodiere GIF…",
  transforming:     "Transformiere Frame {current} / {total}",
  encoding:         "Kodiere Frame {current} / {total}",
  please_wait:      "Bitte warten…",

  // footer buttons
  apply_changes:    "Änderungen anwenden",
  save_gif:         "GIF speichern",
  ready_to_save:    "Bereit zum Speichern",
  save_hint:        'Verfügbar nach „Anwenden“',

  // notifications
  err_open:         "Fehler beim Öffnen",
  err_apply:        "Fehler beim Anwenden",
  err_save:         "Fehler beim Speichern",
  saved:            "Gespeichert",
  saved_msg:        "GIF gespeichert: {path}",

  // color list
  colors_title:     "Farben zum Ersetzen",
  add_color:        "Farbe hinzufügen",
  no_colors:        "Noch keine Farben hinzugefügt.",
  btn_edit:         "Bearbeiten",
  btn_remove:       "Entfernen",
  badge_editing:    "Bearbeiten",

  // add / edit panel
  choose_source:    "Quellfarbe wählen",
  gif_tolerance:    "GIF-Toleranz",
  pick_from_gif:    "Aus GIF auswählen",
  source_from_gif:  "Quellfarbe aus GIF",
  make_transparent: "Transparent machen",
  transparent_hint: "Pixel werden auf Alpha 0 gesetzt",
  tolerance:        "Toleranz",
  tolerance_hint:   "ähnliche Farbtöne einbeziehen",
  tol_prefix:       "Tol.",
  next:             "Weiter →",
  back:             "Zurück",
  cancel:           "Abbrechen",
  add:              "Hinzufügen",
  confirm:          "Übernehmen",
};

type Keys = keyof typeof de;

const en: Record<Keys, string> = {
  no_file:          "No file open",
  color_singular:   "color",
  color_plural:     "colors",
  assigned:         "assigned",
  unsaved:          "unsaved",
  rule_singular:    "rule",
  rule_plural:      "rules",
  on_all_frames:    "on all {n} frames",
  apply_hint:       "Apply rules to all frames",

  minimize:         "Minimize",
  maximize:         "Maximize",
  restore:          "Restore",
  close:            "Close",

  no_file_pill:     "No file",
  open_other:       "Open other",

  preview_open:     "Open a GIF to see preview",
  preview_apply:    "Apply changes to see result",

  live_preview:     "Live Preview",

  decoding:         "Decoding GIF…",
  transforming:     "Transforming frame {current} / {total}",
  encoding:         "Encoding frame {current} / {total}",
  please_wait:      "Please wait…",

  apply_changes:    "Apply changes",
  save_gif:         "Save GIF",
  ready_to_save:    "Ready to save",
  save_hint:        'Available after "Apply"',

  err_open:         "Error opening file",
  err_apply:        "Error applying changes",
  err_save:         "Error saving file",
  saved:            "Saved",
  saved_msg:        "GIF saved: {path}",

  colors_title:     "Colors to replace",
  add_color:        "Add color",
  no_colors:        "No colors added yet.",
  btn_edit:         "Edit",
  btn_remove:       "Remove",
  badge_editing:    "Editing",

  choose_source:    "Choose source color",
  gif_tolerance:    "GIF Tolerance",
  pick_from_gif:    "Pick from GIF",
  source_from_gif:  "Source color from GIF",
  make_transparent: "Make transparent",
  transparent_hint: "Pixels will be set to alpha 0",
  tolerance:        "Tolerance",
  tolerance_hint:   "include similar shades",
  tol_prefix:       "Tol.",
  next:             "Next →",
  back:             "Back",
  cancel:           "Cancel",
  add:              "Add",
  confirm:          "Apply",
};

const lang = navigator.language.startsWith("de") ? "de" : "en";
const strings = lang === "de" ? de : en;

export function t(key: Keys, params?: Record<string, string | number>): string {
  let s = strings[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}
