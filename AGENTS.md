# UI & Design Rules (Portfolio Manager)

## 1. Einheitliche Button-Höhen in Leisten und Gruppen
- **Nebeneinanderliegende Buttons / Badges immer gleich hoch halten:** Alle Buttons, Tabs und kompakten Status-Etiketten in einer gemeinsamen Leiste oder Toolbar müssen exakt die gleiche gerenderte Höhe haben (Standard für Chart-/Toolbar-Leisten: explizite Höhe wie `h-7`, `inline-flex items-center justify-center leading-none py-0`).
- **Auch bei neu eingefügten Buttons:** Wird ein neuer Button in eine bestehende Button-Leiste eingefügt (z. B. `Vor-/Nachbörse` neben `CHF` und `Messen`), übernimmt er exakt die gemeinsame Höhe, `border`-Behandlung, `leading-none` und Innenabstände der bestehenden Buttons (am besten über eine gemeinsame Helper-Klasse), damit keine Höhenunterschiede durch Icons, Borders oder geerbte `line-height` entstehen.

## 2. Deutsche Bezeichnungen ohne unnötige Klammern
- Keine runden Klammern `(...)` um Abkürzungen oder Kennwerte bei kompakten Labels und Badges (z. B. `Kaufpreis Manuell`, `1 M`, `Rendite 1 M`, `Risiko-Abschlag C`).
