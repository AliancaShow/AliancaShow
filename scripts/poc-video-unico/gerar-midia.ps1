# Gera os videos de teste do POC (60 s, 30 fps, H.264) com a caixa movel e o codigo de barras do numero do quadro (vf.txt).
# Precisa do ffmpeg no PATH (winget install Gyan.FFmpeg). Uso: pwsh -File gerar-midia.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$media = Join-Path $root "media"
New-Item -ItemType Directory -Force $media | Out-Null
$vf = (Get-Content (Join-Path $root "vf.txt") -Raw) -replace "`r?`n", ""
foreach ($v in @(@{ n = "test_4k.mp4"; s = "3840x2160" }, @{ n = "test_1080.mp4"; s = "1920x1080" })) {
    $out = Join-Path $media $v.n
    if (Test-Path $out) { Write-Host "ja existe: $out"; continue }
    & ffmpeg -hide_banner -y -f lavfi -i "testsrc2=size=$($v.s):rate=30:duration=60" -vf $vf -c:v libx264 -profile:v high -pix_fmt yuv420p -preset veryfast -crf 18 $out
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg falhou em $($v.n)" }
}
Write-Host "ok: $media"
