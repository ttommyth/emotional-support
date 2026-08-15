# Captures and analyzes headless screenshots of the dev review page so every
# robot action and scene prop can be verified one by one without opening a
# browser. Requires the Vite dev server running (npm run dev) and Edge/Chrome.
#
# Usage (from webview-ui):
#   node_modules/.bin/... no — just:  powershell -File scripts/capture-review-shots.ps1
#   -SkipShots   : reuse already-captured PNGs (only re-analyze)
param(
    [string]$OutDir = (Join-Path $env:TEMP "es-review-shots"),
    [string]$BaseUrl = "http://localhost:5173/dev-review.html",
    [switch]$SkipShots
)

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Drawing

$edge = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'No Edge/Chrome found on this machine.' }
Write-Output "Browser : $edge"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Keep in sync with ACTION_ORDER in src/robot/action-labels.ts
$ACTIONS = @(
    'idle','thinking','coding','debugging','reviewing','refactoring','testing','reading',
    'inspect','success','error','sleep','sit','laydown','laydownflat','rest','running',
    'ballet','walk','wave','stretch','dance','lookaround','shrug','peek','knocked','tidyup',
    'stroll','tripped'
)
# Keep in sync with SCENE_PROP_ACTION_MAP keys in src/robot/types.ts
$PROPS = @('paper','laptop','magnifying_glass','clipboard','wrench','test_tubes','lightbulb','book','coffee_mug','star','trophy')

function Shot([string]$url, [string]$out) {
    if (Test-Path $out) { return }
    & $edge --headless=new --screenshot="$out" --window-size=1400,900 --virtual-time-budget=9000 "$url" 2>&1 | Out-Null
    if (-not (Test-Path $out)) { Write-Warning "No screenshot produced for $url" }
}

if (-not $SkipShots) {
    Write-Output "Capturing $($ACTIONS.Count) actions + $($PROPS.Count) scene props ..."
    foreach ($a in $ACTIONS) {
        Shot "$BaseUrl?action=$a" (Join-Path $OutDir "action-$a.png")
    }
    foreach ($p in $PROPS) {
        Shot "$BaseUrl?prop=$p&pos=center-right" (Join-Path $OutDir "prop-$p.png")
    }
}

function Analyze-Image([string]$path) {
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    try {
        $w = $bmp.Width; $h = $bmp.Height
        $bg = $bmp.GetPixel(4, 4)
        $robX = [int]($w * 0.62)          # robot canvas occupies left 62%
        $step = 2
        $minX = $w; $minY = $h; $maxX = 0; $maxY = 0
        $count = 0; $sx = 0; $sy = 0
        # floor band = bottom 30% of the right half of the robot canvas (where
        # a scene prop placed at center-right appears)
        $fbCount = 0; $fbX0 = [int]($w * 0.5); $fbY0 = [int]($h * 0.72)
        for ($y = 0; $y -lt $h; $y += $step) {
            for ($x = 0; $x -lt $robX; $x += $step) {
                $c = $bmp.GetPixel($x, $y)
                if (([math]::Abs($c.R - $bg.R) + [math]::Abs($c.G - $bg.G) + [math]::Abs($c.B - $bg.B)) -gt 40) {
                    $count++
                    $sx += $x; $sy += $y
                    if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
                    if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
                    if ($x -ge $fbX0 -and $y -ge $fbY0) { $fbCount++ }
                }
            }
        }
        $cx = if ($count) { [math]::Round($sx / $count) } else { 0 }
        $cy = if ($count) { [math]::Round($sy / $count) } else { 0 }
        $cov = [math]::Round($count / (($robX / $step) * ($h / $step)) * 100, 1)
        $ww = $maxX - $minX; $hh = $maxY - $minY
        $aspect = if ($ww -gt 0) { [math]::Round($hh / $ww, 2) } else { 0 }
        [pscustomobject]@{
            Name    = (Split-Path $path -Leaf).Replace('.png', '')
            Vis     = $count
            CovPct  = $cov
            Box     = "($minX,$minY)-($maxX,$maxY)"
            CX      = $cx
            CY      = $cy
            Aspect  = $aspect
            FloorN  = $fbCount
        }
    } finally { $bmp.Dispose() }
}

Write-Output "=== ACTION SHOTS (robot-region metrics) ==="
$actRows = @()
foreach ($a in $ACTIONS) { $actRows += Analyze-Image (Join-Path $OutDir "action-$a.png") }
$actRows | Format-Table -AutoSize

Write-Output "=== SCENE PROP SHOTS (floor-band content = prop presence) ==="
$propRows = @()
foreach ($p in $PROPS) { $propRows += Analyze-Image (Join-Path $OutDir "prop-$p.png") }
$propRows | Format-Table -AutoSize
