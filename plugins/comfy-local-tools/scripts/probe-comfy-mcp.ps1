[CmdletBinding()]
param(
    [switch]$SkipServerInfo,
    [double]$TimeoutSeconds = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$toolPython = Join-Path $env:APPDATA 'uv\tools\comfy-mcp\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $toolPython -PathType Leaf)) {
    throw "comfy-mcp tool Python not found: $toolPython"
}
$probe = Join-Path $PSScriptRoot 'probe-comfy-mcp.py'
$args = @($probe, '--timeout', [string]$TimeoutSeconds)
if ($SkipServerInfo) { $args += '--skip-server-info' }

& $toolPython @args
exit $LASTEXITCODE
