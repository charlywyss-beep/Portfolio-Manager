---
description: Fix für "Blitzen" / "Sub-Pixel Gap" bei Sticky-Spalten in Tabellen
---

# Sticky Column Sub-Pixel Gap Fix

## Problem
Sticky-Spalten (fixiert links/rechts) zeigen beim horizontalen Scrollen ein "Blitzen" oder "Durchscheinen" an den Rändern. Inhalt wird links/rechts der fixierten Spalten kurz sichtbar.

## Ursache
Browser-Rendering-Artefakt: `sticky left-0` oder `sticky right-0` erzeugt bei High-DPI-Displays oder border-collapse Sub-Pixel-Lücken (z.B. 0.5px) zwischen Spalte und Container-Rand.

## Lösung (3 Schritte)

### 1. Sticky-Position um 1px nach außen verschieben
```tsx
// VORHER (falsch)
sticky left-0
sticky right-0

// NACHHER (richtig)
sticky -left-px   // = left: -1px
sticky -right-px  // = right: -1px
```
Die Spalte überlappt den Container-Rand um 1px und schließt die Lücke.

### 2. Container mit Clip versehen
```tsx
// Auf dem äußeren Container (der mit rounded-xl)
className="... overflow-hidden overflow-clip"
```
Schneidet den 1px-Überhang sauber ab.

### 3. Scroll-Elastizität deaktivieren
```tsx
// Auf dem scroll Container (div mit overflow-x-auto)
className="overflow-x-auto overscroll-x-none"
```
Verhindert "Gummiband-Effekt" beim Wischen über das Scroll-Ende hinaus.

## Betroffene Dateien (Portfolio-Manager)
- `src/components/PositionTable.tsx`
- `src/components/FixedDepositTable.tsx`
- `src/components/VorsorgeSection.tsx`
- `src/pages/DividendPlanner.tsx` (2 Tabellen)
- `src/pages/Watchlist.tsx`

## Schnelle Prüfung
1. Browser auf ~600px Breite verkleinern
2. Tabelle horizontal scrollen
3. Auf linken/rechten Rand achten: Blitzt etwas durch?

## Browser-Test (JavaScript)
```javascript
// Container-Grenzen vs. Sticky-Spalten-Grenzen messen
const container = document.querySelector('.overflow-x-auto');
const rect = container.getBoundingClientRect();
const stickyCol = document.querySelector('th:first-child');
const stickyRect = stickyCol.getBoundingClientRect();
console.log('Gap:', rect.left - stickyRect.left); // Sollte ≤ 0 sein
```
