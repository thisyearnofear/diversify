# Workflow
- Stage, commit, and push changes to main branch (avoid feature branches when possible). Confidence: 0.80
- Only update existing documentation files; do not create new docs unless explicitly requested. Confidence: 0.85
- When new docs are created, prefer cross-linking to/from existing related docs (use markdown links with relative paths) rather than restating the same content in multiple places; makes the new doc the single source of truth. Confidence: 0.80
- Skip local builds for the frontend; stage, commit, push and let Vercel handle deployment. Confidence: 0.75
- Use `gh auth switch` to manage GitHub authentication when push fails. Confidence: 0.70
- Stage/commit/push in cogent themed batches rather than one giant commit (e.g., split Trade removal, Arbitrum support, test fixes into separate commits). Confidence: 0.80
- Lead with a plan + score/rating assessment before implementing; user wants opinionated recommendations, not option lists. Confidence: 0.85
- Be opinionated about product/design direction (e.g., opinionated about use case over chain choice) rather than presenting neutral options. Confidence: 0.80
