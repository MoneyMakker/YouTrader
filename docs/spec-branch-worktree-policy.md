# Branch and worktree policy

Use `spec/<id>-<slug>`, `fix/`, `release/`, or `security/` from clean current `origin/main`. The historical dirty worktree is not a valid source. Significant work must use a dedicated worktree; it is never reset, stashed, or deleted automatically.
