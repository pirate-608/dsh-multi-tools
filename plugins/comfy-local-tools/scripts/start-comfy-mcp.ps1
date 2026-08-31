[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-ComfyBinary {
    param(
        [string]$Override,
        [string]$FileName
    )

    if ($Override) {
        $expanded = [Environment]::ExpandEnvironmentVariables($Override)
        if (Test-Path -LiteralPath $expanded -PathType Leaf) {
            return (Resolve-Path -LiteralPath $expanded).Path
        }
        throw "Configured binary does not exist: $expanded"
    }

    $local = Join-Path $env:USERPROFILE ".local\bin\$FileName"
    if (Test-Path -LiteralPath $local -PathType Leaf) {
        return (Resolve-Path -LiteralPath $local).Path
    }

    $command = Get-Command $FileName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command -and $command.Source) {
        return $command.Source
    }
    throw "Could not find $FileName. Install it with uv tool install first."
}

$comfyBinary = Resolve-ComfyBinary -Override $env:COMFY_BIN -FileName 'comfy.exe'
$env:COMFY_BIN = $comfyBinary
$env:COMFY_WHERE = 'local'

$toolPython = Join-Path $env:APPDATA 'uv\tools\comfy-mcp\Scripts\python.exe'
if (Test-Path -LiteralPath $toolPython -PathType Leaf) {
    & $toolPython -m comfy_mcp.server
} else {
    $mcpBinary = Resolve-ComfyBinary -Override $env:COMFY_MCP_BIN -FileName 'comfy-mcp.exe'
    & $mcpBinary
}
exit $LASTEXITCODE
