[CmdletBinding()]
param(
    [switch]$SkipSystemStats
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-LocalBinary {
    param([string]$Name, [string]$Override)
    if ($Override -and (Test-Path -LiteralPath $Override -PathType Leaf)) {
        return (Resolve-Path -LiteralPath $Override).Path
    }
    $candidate = Join-Path $env:USERPROFILE ".local\bin\$Name"
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        return (Resolve-Path -LiteralPath $candidate).Path
    }
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Source }
    return $null
}

function Invoke-ComfyJson {
    param([string]$Comfy, [string[]]$Arguments)
    $text = (& $Comfy --json --where local @Arguments 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        return [ordered]@{ ok = $false; exit_code = $LASTEXITCODE; raw = $text }
    }
    try { return ($text | ConvertFrom-Json) }
    catch { return [ordered]@{ ok = $false; parse_error = $_.Exception.Message; raw = $text } }
}

$comfy = Resolve-LocalBinary -Name 'comfy.exe' -Override $env:COMFY_BIN
$mcp = Resolve-LocalBinary -Name 'comfy-mcp.exe' -Override $env:COMFY_MCP_BIN
$report = [ordered]@{
    checked_at = (Get-Date).ToString('o')
    comfy_bin = $comfy
    comfy_mcp_bin = $mcp
    comfy_cli = $null
    selected_workspace = $null
    environment = $null
    system_stats = $null
    warnings = @()
}

if (-not $comfy) { $report.warnings += 'comfy.exe not found'; $report | ConvertTo-Json -Depth 100; exit 1 }
if (-not $mcp) { $report.warnings += 'comfy-mcp.exe not found' }

$report.comfy_cli = Invoke-ComfyJson -Comfy $comfy -Arguments @('--version')
$report.selected_workspace = Invoke-ComfyJson -Comfy $comfy -Arguments @('which')
$report.environment = Invoke-ComfyJson -Comfy $comfy -Arguments @('env')
$running = $false
if ($report.environment -and $report.environment.PSObject.Properties['data']) {
    if ($report.environment.data -and $report.environment.data.server) {
        $running = [bool]$report.environment.data.server.running
    }
}

if ($running -and -not $SkipSystemStats) {
    $report.system_stats = Invoke-ComfyJson -Comfy $comfy -Arguments @('system-stats')
}
if (-not $running) {
    $report.warnings += 'No local ComfyUI server is running. Start Comfy Desktop or use launch_comfyui/comfy launch.'
}
if ($running -and $report.system_stats -and $report.system_stats.data.system.deploy_environment -like 'local-desktop*') {
    $report.warnings += 'A Comfy Desktop standalone instance is running; its process arguments are authoritative even if comfy which reports another workspace.'
}

$report | ConvertTo-Json -Depth 100
if (-not $mcp) { exit 1 }
if (-not $running) { exit 2 }
exit 0
