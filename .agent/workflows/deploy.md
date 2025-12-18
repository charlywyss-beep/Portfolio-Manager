---
description: Deployment Workflow (Update Version -> Build -> Push)
---

This workflow defines the strict process for deploying a new version of the Portfolio Manager.

1. **Update Version**:
   - Increment `version` in `package.json`.
   - Update the displayed version string in `src/App.tsx`.

2. **Build**:
   - Run the build command to ensure the code is valid and assets are generated.
   // turbo
   `npm run build`

3. **Deploy (Git Push)**:
   - Stage all changes.
   - Commit with a descriptive message including the version number.
   - Push to the remote repository.
   // turbo
   `git add . && git commit -m "update: v<VERSION> - <DESCRIPTION>" && git push`

4. **Notify**:
   - ONLY AFTER the push command succeeds (exit code 0), notify the user.
