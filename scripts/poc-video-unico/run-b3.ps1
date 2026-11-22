# Usage: pwsh -File run-b3.ps1 -Runs "url=file;url=http;url=file,driver=rvfc;url=file,load=1;url=file,test=crash" [-Dur 30] [-Warm 8]
# Each run: electron . --poc-variant=b3 --poc-<k>=<v>...; GPU VideoDecode/3D counters sampled like run.ps1 while measuring.json exists.
param([string]$Runs = "url=file", [int]$Dur = 30, [int]$Warm = 8)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$electron = Join-Path $root "..\..\node_modules\electron\dist\electron.exe" | Resolve-Path
$res = Join-Path $root "results"; New-Item -ItemType Directory -Force $res | Out-Null
$flag = Join-Path $res "measuring.json"
foreach ($r in $Runs.Split(";")) {
  Remove-Item $flag -ErrorAction SilentlyContinue
  $a = @("`"$root`"", "--poc-variant=b3", "--poc-dur=$Dur", "--poc-warm=$Warm") + ($r.Split(",") | ForEach-Object { "--poc-$_" })
  $p = Start-Process -FilePath $electron -ArgumentList $a -PassThru
  $deadline = (Get-Date).AddSeconds($Dur + $Warm + 150)
  while (-not $p.HasExited -and (Get-Date) -lt $deadline) {
    if (-not (Test-Path $flag)) { Start-Sleep -Milliseconds 200; continue }
    $info = Get-Content $flag -Raw | ConvertFrom-Json; $pids = @($info.pids)
    $ctr = Get-Counter -Counter @('\GPU Engine(*engtype_VideoDecode)\Utilization Percentage', '\GPU Engine(*engtype_3D)\Utilization Percentage') -SampleInterval 1 -MaxSamples ([int]$info.dur - 2) -ErrorAction SilentlyContinue
    $rows = foreach ($s in $ctr) {
      $dec = 0; $d3 = 0
      foreach ($c in $s.CounterSamples) {
        if ($c.InstanceName -match '^pid_(\d+)_' -and ($pids -contains [int]$Matches[1])) { if ($c.InstanceName -like "*videodecode*") { $dec += $c.CookedValue } else { $d3 += $c.CookedValue } }
      }
      [pscustomobject]@{ dec = $dec; d3 = $d3 }
    }
    $g = [ordered]@{ tag = $info.tag; samples = $rows.Count; decodeMean = [math]::Round(($rows | Measure-Object dec -Average).Average, 1); decodeMax = [math]::Round(($rows | Measure-Object dec -Maximum).Maximum, 1); d3Mean = [math]::Round(($rows | Measure-Object d3 -Average).Average, 1) }
    $g | ConvertTo-Json | Set-Content (Join-Path $res "$($info.tag).gpu.json")
    Write-Host ("{0}: decode {1}% (max {2}) 3D {3}%" -f $info.tag, $g.decodeMean, $g.decodeMax, $g.d3Mean)
    while ((Test-Path $flag) -and -not $p.HasExited) { Start-Sleep -Milliseconds 200 }
  }
  if (-not $p.HasExited) { Write-Warning "$r did not exit, killing"; & taskkill /T /F /PID $p.Id | Out-Null }
  Start-Sleep 2
}
