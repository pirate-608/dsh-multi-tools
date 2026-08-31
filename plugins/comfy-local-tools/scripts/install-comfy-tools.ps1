[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw 'uv is required. Install uv, then rerun this explicit runtime install command.'
}

$tools = @(
    [ordered]@{ Package = 'comfy-cli'; Binary = 'comfy.exe' },
    [ordered]@{ Package = 'comfy-mcp'; Binary = 'comfy-mcp.exe' }
)

foreach ($tool in $tools) {
    $installed = Get-Command $tool.Binary -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($installed) {
        Write-Output "$($tool.Package) is already installed at $($installed.Source)"
        continue
    }

    & uv tool install $tool.Package
    if ($LASTEXITCODE -ne 0) {
        throw "uv tool install $($tool.Package) failed with exit code $LASTEXITCODE"
    }
}

Write-Output 'Comfy local tools are installed. This command did not install ComfyUI, pull models, start services, or configure COMFY_API_KEY.'
