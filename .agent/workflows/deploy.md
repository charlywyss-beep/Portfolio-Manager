---
description: Build and Deploy the Application
---

// turbo-all
1. Bump version (patch), Build, and Push
```powershell
$ver = npm version patch --no-git-tag-version; npm run build; git add .; git commit -m "${ver}: Deployment Update"; git push
```
