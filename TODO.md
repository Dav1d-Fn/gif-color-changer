# TODO

- [x] **Settings bei Bild-Wechsel behalten** — Color-Entries / Regeln nicht verwerfen, wenn ein neues GIF geladen wird
- [x] **Weitere Sprachen hinzufügen** — über die bereits vorhandenen (de/en/fr/es) hinaus, außerdem ist einiges aktuell nur eine sprache und wechselt nicht
  - fr/es waren nur zu ~5 von ~90 Keys übersetzt (Rest fiel still auf Englisch zurück) — jetzt vollständig übersetzt; außerdem diverse hartkodierte de/en-Strings in App.tsx, ColorEntryList.tsx, BatchTab.tsx, GifPreview.tsx durch `t()` ersetzt
  - Weitere Sprachen über de/en/fr/es hinaus noch offen — bei Bedarf bitte sagen, welche
- [x] **Color Picker fixen** — aktuell lassen sich Farben nur aus dem ersten Frame auswählen; Eyedropper soll den aktuell angezeigten Frame nutzen
- [x] **Original-GIF mit Slider synchronisieren** — wenn das GIF pausiert ist, soll der Frame-Slider auch das Original-Panel auf den gleichen Frame springen lassen
- [x] **Pause-Button hinzufügen** — Play/Pause für das GIF, aber deaktiviert (disabled) solange Live-Preview aktiv ist
- [x] **Nur eine Regel gleichzeitig editierbar machen** — Edit-Status (welche Regel/Add-Panel gerade offen ist) liegt jetzt zentral in `ColorEntryList`; beim Versuch, eine zweite Regel oder das Add-Panel zu öffnen während eine Regel ungespeicherte Änderungen hat, erscheint ein Popup (Speichern / Verwerfen / Abbrechen)
- [x] **GIF-Toleranz-Slider aus Step 1 (Regel anlegen) entfernen** — im Add-Panel ist der Slider in Step 1 ausgeblendet; beim Öffnen wird automatisch mit `defaultTol + 10` (geclamped 30–100) geladen. Beim Bearbeiten einer bestehenden Regel bleibt der Slider wie gehabt sichtbar
