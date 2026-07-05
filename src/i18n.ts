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
  save_hint:        'Verfügbar nach „Anwenden"',

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
  unmatte:          "Hintergrund herausrechnen",
  unmatte_hint:     "Subtrahiert die Hintergrundfarbe und stellt Originalfarben wieder her",
  unmatte_tol_hint: "Alpha-Schwellwert — Pixel darunter werden transparent",
  tolerance:        "Toleranz",
  tolerance_hint:   "ähnliche Farbtöne einbeziehen",
  border:           "Rand",
  border_hint:      "Randpixel um die ersetzte Fläche mitnehmen",
  tol_prefix:       "Tol.",
  next:             "Weiter →",
  back:             "Zurück",
  cancel:           "Abbrechen",
  add:              "Hinzufügen",
  confirm:          "Übernehmen",

  // sidebar
  home_title:           "Home",
  sidebar_home:         "Home",
  sidebar_batch:        "Batch",
  sidebar_settings:     "Einstellungen",
  lang_switch_tooltip:  "Sprache wechseln",

  // rules I/O
  rules_import_tooltip: "Regeln importieren (.json)",
  rules_export_tooltip: "Regeln exportieren (.json)",
  rules_import_title:   "Regeln importieren",
  rules_import_body:    "{n} bestehende Regel(n) werden ersetzt. Fortfahren?",
  rules_import_replace: "Ersetzen",
  rules_import_add:     "Hinzufügen",
  rules_import_error:   "Import fehlgeschlagen — kein gültiges Regel-Format.",
  rules_export_success: "{n} Regeln gespeichert",

  // batch tab
  batch_title:           "Batch verarbeiten",
  batch_sub_none:        "0 GIFs ausgewählt",
  batch_sub:             "{n} GIF(s) ausgewählt · {r} Regel(n) aktiv",
  batch_add_gifs:        "GIFs hinzufügen",
  batch_card_files:      "GIFs",
  batch_remove_all:      "Alle entfernen",
  batch_drop_hint:       "Oder GIFs hier hineinziehen",
  batch_empty_label:     "GIFs hierhin ziehen",
  batch_empty_hint:      'oder über „GIFs hinzufügen" oben rechts auswählen',
  batch_card_rules:      "Aktive Regeln",
  batch_rules_note:      "Werden aus dem Home-Tab übernommen. Hier nicht bearbeitbar, aber importierbar / exportierbar.",
  batch_card_export:     "Export",
  batch_dest_folder:     "Ziel-Ordner",
  batch_browse:          "Durchsuchen",
  batch_schema:          "Datei-Schema",
  batch_schema_help:     "Beispiel: {example}",
  batch_process_btn:     "Verarbeiten",
  batch_process_sub:     "{n} GIF(s) · {f} Frames · ~{s} Sek.",
  batch_open_folder:     "Im Ziel-Ordner öffnen",
  batch_open_sub_wait:   "Nach Abschluss aktivierbar",
  batch_open_sub_done:   "{n} Datei(en) geschrieben",
  batch_status_idle:     "Bereit",
  batch_status_proc:     "Wird verarbeitet…",
  batch_status_done:     "Fertig",
  batch_status_error:    "Fehler",
  batch_err_no_folder:   "Bitte Ziel-Ordner auswählen",
  batch_invalid_gif:     "Keine gültige GIF-Datei",
  batch_done_toast:      "Batch abgeschlossen — {n} Datei(en) gespeichert",

  // settings tab
  settings_title:             "Allgemein",
  settings_auto_saved:        "Werden automatisch gespeichert",
  settings_lang:              "Sprache",
  settings_default_tol:       "Standard-Toleranz",
  settings_border_expand:     "Rand-Erweiterung (px)",
  settings_live_preview_default: "Live-Preview Standard",
  settings_export_folder:     "Standard-Export-Ordner",
  settings_file_schema:       "Datei-Schema",
  settings_overwrite:         "Original überschreiben",
  settings_overwrite_ask:     "Nachfragen",
  settings_overwrite_replace: "Überschreiben",
  settings_overwrite_rename:  "Umbenennen",
  settings_about_name:        "GIF Color Changer",
  settings_about_version:     "Version 1.2.0",
  settings_about_tagline:     "Ersetze Farben in animierten GIFs — lokal, schnell, ohne Cloud.",
  settings_about_copyright:   "© 2026 · Lokale Anwendung · keine Daten verlassen dein Gerät",
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
  unmatte:          "Remove background color",
  unmatte_hint:     "Subtracts the background color and recovers original pixel colors",
  unmatte_tol_hint: "Alpha cutoff — pixels below this % become transparent",
  tolerance:        "Tolerance",
  tolerance_hint:   "include similar shades",
  border:           "Border",
  border_hint:      "expand replaced area by edge pixels",
  tol_prefix:       "Tol.",
  next:             "Next →",
  back:             "Back",
  cancel:           "Cancel",
  add:              "Add",
  confirm:          "Apply",

  home_title:           "Home",
  sidebar_home:         "Home",
  sidebar_batch:        "Batch",
  sidebar_settings:     "Settings",
  lang_switch_tooltip:  "Switch language",

  rules_import_tooltip: "Import rules (.json)",
  rules_export_tooltip: "Export rules (.json)",
  rules_import_title:   "Import rules",
  rules_import_body:    "{n} existing rule(s) will be replaced. Continue?",
  rules_import_replace: "Replace",
  rules_import_add:     "Add",
  rules_import_error:   "Import failed — not a valid rules file.",
  rules_export_success: "{n} rules saved",

  batch_title:           "Batch Process",
  batch_sub_none:        "0 GIFs selected",
  batch_sub:             "{n} GIF(s) selected · {r} rule(s) active",
  batch_add_gifs:        "Add GIFs",
  batch_card_files:      "GIFs",
  batch_remove_all:      "Remove all",
  batch_drop_hint:       "Or drag GIFs here",
  batch_empty_label:     "Drag GIFs here",
  batch_empty_hint:      'or select via "Add GIFs" above',
  batch_card_rules:      "Active Rules",
  batch_rules_note:      "Taken from the Home tab. Cannot be edited here, but can be imported / exported.",
  batch_card_export:     "Export",
  batch_dest_folder:     "Target Folder",
  batch_browse:          "Browse",
  batch_schema:          "File Schema",
  batch_schema_help:     "Example: {example}",
  batch_process_btn:     "Process",
  batch_process_sub:     "{n} GIF(s) · {f} frames · ~{s} sec.",
  batch_open_folder:     "Open in target folder",
  batch_open_sub_wait:   "Available after processing",
  batch_open_sub_done:   "{n} file(s) written",
  batch_status_idle:     "Ready",
  batch_status_proc:     "Processing…",
  batch_status_done:     "Done",
  batch_status_error:    "Error",
  batch_err_no_folder:   "Please select a target folder",
  batch_invalid_gif:     "Not a valid GIF file",
  batch_done_toast:      "Batch complete — {n} file(s) saved",

  settings_title:             "General",
  settings_auto_saved:        "Saved automatically",
  settings_lang:              "Language",
  settings_default_tol:       "Default Tolerance",
  settings_border_expand:     "Border Expansion (px)",
  settings_live_preview_default: "Live Preview Default",
  settings_export_folder:     "Default Export Folder",
  settings_file_schema:       "File Schema",
  settings_overwrite:         "Overwrite original",
  settings_overwrite_ask:     "Ask",
  settings_overwrite_replace: "Overwrite",
  settings_overwrite_rename:  "Rename",
  settings_about_name:        "GIF Color Changer",
  settings_about_version:     "Version 1.2.0",
  settings_about_tagline:     "Replace colors in animated GIFs — local, fast, no cloud.",
  settings_about_copyright:   "© 2026 · Local application · no data leaves your device",
};

const fr: Record<Keys, string> = { ...en,
  home_title:       "Accueil",
  sidebar_home:     "Accueil",
  sidebar_settings: "Paramètres",
  lang_switch_tooltip: "Changer de langue",
  settings_lang:    "Langue",
};

const es: Record<Keys, string> = { ...en,
  home_title:       "Inicio",
  sidebar_home:     "Inicio",
  sidebar_settings: "Ajustes",
  lang_switch_tooltip: "Cambiar idioma",
  settings_lang:    "Idioma",
};

const allStrings: Record<string, Record<Keys, string>> = { de, en, fr, es };

let activeLang: "de" | "en" | "fr" | "es" = "en";
let strings: Record<Keys, string> = en;
let reRenderCallback: (() => void) | null = null;

export function setLanguage(lang: "de" | "en" | "fr" | "es") {
  activeLang = lang;
  strings = allStrings[lang] ?? en;
  reRenderCallback?.();
}

export function getActiveLang(): "de" | "en" | "fr" | "es" {
  return activeLang;
}

export function registerLangCallback(cb: () => void) {
  reRenderCallback = cb;
}

export function t(key: Keys, params?: Record<string, string | number>): string {
  let s = strings[key] ?? en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}
