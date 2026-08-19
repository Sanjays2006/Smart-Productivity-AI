# ─────────────────────────────────────────────────────────────────────────────
# FocusAI — create a PRIVATE remote and push
# Run AFTER git-setup.ps1 (repo must already be initialized & committed).
# Run from the project root.
#
#   powershell -ExecutionPolicy Bypass -File .\git-push-remote.ps1
# ─────────────────────────────────────────────────────────────────────────────

# Pre-flight: must be a git repo with at least one commit
if (-not (Test-Path ".git")) { Write-Host "No .git here — run git-setup.ps1 first." -ForegroundColor Red; exit 1 }
if (-not (git log --oneline -1 2>$null)) { Write-Host "No commits yet — run git-setup.ps1 first." -ForegroundColor Red; exit 1 }

Write-Host "Choose how to create the remote:" -ForegroundColor Cyan
Write-Host "  [1] GitHub CLI (gh) — creates the private repo AND pushes automatically"
Write-Host "  [2] Manual — you already created an empty repo on GitHub/GitLab"
$choice = Read-Host "Enter 1 or 2"

if ($choice -eq "1") {
    # Requires: winget install --id GitHub.cli   then   gh auth login
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        Write-Host "gh not found. Install with:  winget install --id GitHub.cli" -ForegroundColor Red
        exit 1
    }
    $name = Read-Host "Repo name (default: focusai)"
    if ([string]::IsNullOrWhiteSpace($name)) { $name = "focusai" }
    # Creates a PRIVATE repo from the current folder, sets 'origin', and pushes.
    gh repo create $name --private --source=. --remote=origin --push
    Write-Host "Done. Private repo '$name' created and pushed." -ForegroundColor Green
}
elseif ($choice -eq "2") {
    $url = Read-Host "Paste the empty remote URL (e.g. https://github.com/you/focusai.git)"
    git remote remove origin 2>$null
    git remote add origin $url
    git push -u origin main
    Write-Host "Done. Pushed to $url" -ForegroundColor Green
}
else {
    Write-Host "Invalid choice." -ForegroundColor Red
}
