# ─────────────────────────────────────────────────────────────────────────────
# FocusAI — rebuild the frontend JS bundle
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File .\frontend\build-bundle.ps1
# Concatenates + minifies js/api.js, js/theme.js, js/app/*.js (in order),
# and js/history|monitor|ai-chat|rag-monitor into js/app.bundle.min.js
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path   # frontend/
$js   = Join-Path $here "js"
$appDir = Join-Path $js "app"

# Load order: api, theme, then app/* (preamble first, then numeric), then the rest
$appFiles = Get-ChildItem -Path $appDir -Filter *.js |
    Sort-Object { if ($_.Name -like "*preamble*") { "0" } else { $_.Name } } |
    ForEach-Object { "app/" + $_.Name }

$order = @("api.js","theme.js") + $appFiles + @("history.js","monitor.js","ai-chat.js","rag-monitor.js")

$sb = New-Object System.Text.StringBuilder
foreach ($rel in $order) {
    $p = Join-Path $js $rel
    if (Test-Path $p) {
        [void]$sb.AppendLine("/* === $rel === */")
        [void]$sb.AppendLine((Get-Content -Raw -Path $p))
    } else {
        Write-Host "  (skipped missing $rel)" -ForegroundColor Yellow
    }
}
$raw = $sb.ToString()

# Lightweight minify: drop // line comments and blank lines (safe, string-aware skipped for simplicity).
# NOTE: keeps block comments and is intentionally conservative to avoid breaking strings/regex.
$lines = $raw -split "`n"
$out = foreach ($l in $lines) {
    $t = $l.TrimEnd()
    if ($t.Trim() -eq "") { continue }
    $t
}
$bundle = ($out -join "`n")

$target = Join-Path $js "app.bundle.min.js"
Set-Content -Path $target -Value $bundle -Encoding UTF8 -NoNewline

$kb = [math]::Round((Get-Item $target).Length / 1KB, 1)
Write-Host "Bundle rebuilt: js/app.bundle.min.js ($kb KB) from $($order.Count) files" -ForegroundColor Green
Write-Host "Hard-refresh the browser (Ctrl+F5) to load it." -ForegroundColor Cyan
