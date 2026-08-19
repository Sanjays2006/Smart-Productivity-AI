# ─────────────────────────────────────────────────────────────────────────────
# FocusAI — one-time git setup
# Run from the project root:  C:\Users\sakth\OneDrive\Documents\Full stack AI
# Usage:  powershell -ExecutionPolicy Bypass -File .\git-setup.ps1
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "Initializing git repository for FocusAI..." -ForegroundColor Cyan

# 1. Init (safe to re-run; does nothing if already a repo)
if (-not (Test-Path ".git")) {
    git init
    git branch -M main
} else {
    Write-Host ".git already exists — skipping init." -ForegroundColor Yellow
}

# 2. Show what WILL be committed (respecting .gitignore) BEFORE staging.
#    Review this list — no .env, no *.mv.db, no *.bak, no build/ should appear.
Write-Host "`nFiles that would be tracked (Ctrl-C now if you see secrets):" -ForegroundColor Cyan
git add -A --dry-run

Write-Host "`nSafety check — these patterns should NOT appear above:" -ForegroundColor Yellow
Write-Host "   .env   *.mv.db   *.bak   build/   postgres-config.properties"

# 3. Stage + initial commit
Read-Host "`nPress Enter to stage & commit, or Ctrl-C to abort"
git add -A
git commit -m "Initial commit: FocusAI (secrets externalized, RAG refactor, app.js modularized)"

Write-Host "`nDone. Verify with:  git log --oneline  and  git status" -ForegroundColor Green
Write-Host "Next: create a private remote (GitHub/GitLab) and:" -ForegroundColor Green
Write-Host "   git remote add origin <URL>" -ForegroundColor Green
Write-Host "   git push -u origin main" -ForegroundColor Green
