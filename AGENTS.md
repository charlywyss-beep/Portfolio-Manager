# UI & Design Rules (Portfolio Manager)

## 1. Einheitliche Button-Höhen in Leisten und Gruppen
- **Nebeneinanderliegende Buttons / Badges immer gleich hoch halten:** Alle Buttons, Tabs und kompakten Status-Etiketten in einer gemeinsamen Leiste oder Toolbar müssen exakt die gleiche gerenderte Höhe haben (Standard für Chart-/Toolbar-Leisten: explizite Höhe wie `h-7`, `inline-flex items-center justify-center leading-none py-0`).
- **Auch bei neu eingefügten Buttons:** Wird ein neuer Button in eine bestehende Button-Leiste eingefügt (z. B. `Vor-/Nachbörse` neben `CHF` und `Messen`), übernimmt er exakt die gemeinsame Höhe, `border`-Behandlung, `leading-none` und Innenabstände der bestehenden Buttons (am besten über eine gemeinsame Helper-Klasse), damit keine Höhenunterschiede durch Icons, Borders oder geerbte `line-height` entstehen.

## 2. Deutsche Bezeichnungen ohne unnötige Klammern
- Keine runden Klammern `(...)` um Abkürzungen oder Kennwerte bei kompakten Labels und Badges (z. B. `Kaufpreis Manuell`, `1 M`, `Rendite 1 M`, `Risiko-Abschlag C`).

## 3. Build- & Push-Workflow (Lokal vs. „Run Build“)
- **Standard bei normalen Änderungen am PC:** Nur Quelldateien (`src/...`) ändern und die Version in `package.json` trotzdem jedes Mal hochzählen. **Kein** `npm run build` (`docs/`) und **kein** `git push`, solange der User am PC lokal testet (`localhost:5173` lädt Änderungen per Vite direkt nach; maximal optional ein schnelles `npx tsc --noEmit` falls nötig).
- **Erst auf explizite Anweisung (z. B. „Run Build“, „Hochladen“ oder „Push“):** Dann `npm run build` ausführen (`docs/` neu erzeugen), committen und nach `origin main` pushen.
- **Wichtige Ausnahme für iPad & iPhone:** Sobald Änderungen die mobile Ansicht betreffen oder für iPad/iPhone getestet werden, **immer automatisch** `npm run build`, committen und direkt nach `origin main` pushen, damit der User es sofort auf den echten Mobilgeräten prüfen kann.

