[CmdletBinding()]
param(
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$ComfyArguments
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$comfy = $env:COMFY_BIN
if (-not $comfy) {
    $comfy = Join-Path $env:USERPROFILE '.local\bin\comfy.exe'
}
if (-not (Test-Path -LiteralPath $comfy -PathType Leaf)) {
    $resolved = Get-Command 'comfy.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $resolved) { throw 'comfy.exe was not found. Install it with uv tool install comfy-cli.' }
    $comfy = $resolved.Source
}
if ($ComfyArguments -contains '--where') {
    throw 'Do not pass --where; this wrapper always targets the local ComfyUI.'
}

& $comfy --where local @ComfyArguments
exit $LASTEXITCODE
