---
description: Version erhöhen bei jedem Deployment
---

# Version Bump Workflow

**KRITISCH:** Dieser Workflow MUSS bei JEDEM Code-Deployment ausgeführt werden!

## Schritte

1. **Inkrementiere die Version in `package.json`**
   - Aktueller Wert: `3.11.XXX`
   - Neuer Wert: `3.11.XXX+1`

2. **Update die Sidebar-Version in `App.tsx`** (Zeile ~155)
   ```typescript
   <span>v3.11.XXX</span>
   ```

3. **Update die Header-Version in `App.tsx`** (Zeile ~203)
   ```typescript
   v3.11.XXX
   ```

4. **Commit mit Versionsnummer**
   ```bash
   git commit -m "v3.11.XXX: [Beschreibung der Änderung]"
   ```

5. **Push to GitHub**
   ```bash
   git push
   ```

## Automatische Erinnerung

**Bevor du `git push` ausführst, FRAGE DICH:**
- Habe ich die Version in allen 3 Dateien erhöht?
- Habe ich die neue Version dem User mitgeteilt?

❌ **NIEMALS ohne Version-Bump deployen!**
