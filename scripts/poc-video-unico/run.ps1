# Usage: pwsh -File run.ps1 [-Runs "a:1080","b:4k","b-hidden:4k",...] [-Dur 30] [-Warm 8]
param([string]$Runs = "a:1080,b:1080,b2:1080,c:1080,a:4k,b:4k,b2:4k,c:4k,b-hidden:4k", [int]$Dur = 30, [int]$Warm = 8, [string]$Chaos = "")
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$electron = Join-Path $root "..\..\node_modules\electron\dist\electron.exe" | Resolve-Path
$res = Join-Path $root "results"; New-Item -ItemType Directory -Force $res | Out-Null
$flag = Join-Path $res "measuring.json"
foreach ($r in $Runs.Split(",")) {
  $v, $m = $r.Split(":"); $owner = "main"; if ($v -like "*-hidden") { $v = $v.Replace("-hidden", ""); $owner = "hidden" }
  Remove-Item $flag -ErrorAction SilentlyContinue
  $a = @("`"$root`"", "--poc-variant=$v", "--poc-media=$m", "--poc-owner=$owner", "--poc-dur=$Dur", "--poc-warm=$Warm")
  if ($Chaos) { $a += "--poc-chaos=$Chaos" }
  $crash = $Chaos -like 'crash*'
  $p = Start-Process -FilePath $electron -ArgumentList $a -PassThru
  $t = 0; while (-not (Test-Path $flag) -and $t -lt 120) { Start-Sleep -Milliseconds 250; $t++ }
  if (-not (Test-Path $flag)) { Write-Warning "$r never started measuring"; & taskkill /T /F /PID $p.Id | Out-Null; continue }
  $info = Get-Content $flag -Raw | ConvertFrom-Json
  if ($crash) { if (-not $p.WaitForExit(30000)) { & taskkill /T /F /PID $p.Id | Out-Null }; Write-Host "$r crash test done"; continue }
  $pids = @($info.pids)
  $cpu0 = 0; foreach ($x in Get-Process -Id $pids -ErrorAction SilentlyContinue) { $cpu0 += $x.TotalProcessorTime.TotalSeconds }; $w0 = Get-Date
  $ctr = Get-Counter -Counter @('\GPU Engine(*engtype_VideoDecode)\Utilization Percentage', '\GPU Engine(*engtype_3D)\Utilization Percentage') -SampleInterval 1 -MaxSamples ($Dur - 2) -ErrorAction SilentlyContinue
  $rows = foreach ($s in $ctr) {
    $dec = 0; $d3 = 0; $decAll = 0; $d3All = 0
    foreach ($c in $s.CounterSamples) {
      $isDec = $c.InstanceName -like "*videodecode*"; $own = $false
      if ($c.InstanceName -match '^pid_(\d+)_') { $own = $pids -contains [int]$Matches[1] }
      if ($isDec) { $decAll += $c.CookedValue; if ($own) { $dec += $c.CookedValue } } else { $d3All += $c.CookedValue; if ($own) { $d3 += $c.CookedValue } }
    }
    [pscustomobject]@{ dec = $dec; d3 = $d3; decAll = $decAll; d3All = $d3All }
  }
  $cpu1 = 0; foreach ($x in Get-Process -Id $pids -ErrorAction SilentlyContinue) { $cpu1 += $x.TotalProcessorTime.TotalSeconds }; $el = ((Get-Date) - $w0).TotalSeconds
  $g = [ordered]@{ tag = $info.tag; samples = $rows.Count; cpuPctOneCore = [math]::Round(100 * ($cpu1 - $cpu0) / $el, 1); cpuPctMachine = [math]::Round(100 * ($cpu1 - $cpu0) / $el / [Environment]::ProcessorCount, 1)
    decodeMean = [math]::Round(($rows | Measure-Object dec -Average).Average, 1); decodeMax = [math]::Round(($rows | Measure-Object dec -Maximum).Maximum, 1)
    d3Mean = [math]::Round(($rows | Measure-Object d3 -Average).Average, 1); d3Max = [math]::Round(($rows | Measure-Object d3 -Maximum).Maximum, 1)
    decodeAllProcsMean = [math]::Round(($rows | Measure-Object decAll -Average).Average, 1); d3AllProcsMean = [math]::Round(($rows | Measure-Object d3All -Average).Average, 1) }
  $g | ConvertTo-Json | Set-Content (Join-Path $res "$($info.tag).gpu.json")
  if (-not $p.WaitForExit(30000)) { Write-Warning "$r did not exit, killing"; & taskkill /T /F /PID $p.Id | Out-Null }
  Write-Host ("{0}: decode {1}% (max {2}) 3D {3}% cpu {4}% of 1 core" -f $info.tag, $g.decodeMean, $g.decodeMax, $g.d3Mean, $g.cpuPctOneCore)
  Start-Sleep 2
}
