---
description: Build and Deploy the Application
---

// turbo-all
1. Bump version (patch), Build, and Push
```bash
npm version patch --no-git-tag-version && npm run build && git add . && git commit -m "chore: auto-deploy update" && git push
```
