param(
    [string]$Version = "3.0.0",
    [string]$PackageName = "Spitit",
    [string]$Publisher = "CN=Spitit",
    [string]$PublisherDisplayName = "REREAL",
    [string]$DisplayName = "Spitit",
    [string]$ExePath = "",
    [string]$OutputDir = "release-artifacts"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Spitit MSIX Packaging Script ==="
Write-Host "Version: $Version"
Write-Host "Package Name: $PackageName"
Write-Host "Publisher: $Publisher"
Write-Host "Publisher Display Name: $PublisherDisplayName"

# Locate makeappx.exe from Windows SDK
$makeAppx = ""
$sdkCommand = Get-Command makeappx.exe -ErrorAction SilentlyContinue
if ($sdkCommand) {
    $makeAppx = $sdkCommand.Source
} else {
    $sdkPaths = @(
        "C:\Program Files (x86)\Windows Kits\10\bin",
        "C:\Program Files\Windows Kits\10\bin"
    )
    foreach ($path in $sdkPaths) {
        if (Test-Path $path) {
            $found = Get-ChildItem -Path $path -Filter "makeappx.exe" -Recurse -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -like "*x64*" } |
                Select-Object -First 1
            if ($found) {
                $makeAppx = $found.FullName
                break
            }
        }
    }
}

if (-not $makeAppx -or -not (Test-Path $makeAppx)) {
    Write-Error "Could not find makeappx.exe in Windows Kits SDK. Ensure the Windows SDK is installed."
    exit 1
}

Write-Host "Found makeappx.exe at: $makeAppx"

# Locate executable
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $ExePath) {
    $candidates = @(
        (Join-Path $repoRoot "src-tauri/target/release/spitit-v3.exe"),
        (Join-Path $repoRoot "src-tauri/target/release/Spitit.exe"),
        "src-tauri/target/release/spitit-v3.exe",
        "src-tauri/target/release/Spitit.exe"
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            $ExePath = $cand
            break
        }
    }
}

if (-not $ExePath -or -not (Test-Path $ExePath)) {
    Write-Error "Could not locate compiled executable Spitit.exe or spitit-v3.exe at $ExePath"
    exit 1
}

Write-Host "Using executable: $ExePath"

# Format 4-part version for MSIX (e.g. 3.0.0 -> 3.0.0.0)
$cleanVer = $Version.TrimStart("v")
$parts = $cleanVer.Split(".")
while ($parts.Count -lt 4) {
    $parts += "0"
}
$quadVersion = ($parts[0..3] -join ".")
Write-Host "Quad Version for Manifest: $quadVersion"

# Prepare staging layout folder
$layoutDir = Join-Path $PSScriptRoot "layout"
if (Test-Path $layoutDir) {
    Remove-Item -Path $layoutDir -Recurse -Force
}
New-Item -ItemType Directory -Path $layoutDir -Force | Out-Null
$assetsDir = Join-Path $layoutDir "Assets"
New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null

# Copy application executable as Spitit.exe
Copy-Item -Path $ExePath -Destination (Join-Path $layoutDir "Spitit.exe") -Force

# Copy Store Assets
$iconSource = Join-Path $repoRoot "src-tauri/icons"
if (-not (Test-Path $iconSource)) {
    $iconSource = "src-tauri/icons"
}
$requiredIcons = @(
    "Square150x150Logo.png",
    "Square44x44Logo.png",
    "Square71x71Logo.png",
    "Square310x310Logo.png",
    "StoreLogo.png"
)
foreach ($icon in $requiredIcons) {
    $src = Join-Path $iconSource $icon
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $assetsDir $icon) -Force
    } else {
        Write-Warning "Icon missing: $src"
    }
}

# Generate AppxManifest.xml from template
$templatePath = Join-Path $PSScriptRoot "AppxManifest.template.xml"
$manifestContent = Get-Content -Path $templatePath -Raw
$manifestContent = $manifestContent.Replace("{{PACKAGE_NAME}}", $PackageName)
$manifestContent = $manifestContent.Replace("{{PUBLISHER}}", $Publisher)
$manifestContent = $manifestContent.Replace("{{VERSION}}", $quadVersion)
$manifestContent = $manifestContent.Replace("{{DISPLAY_NAME}}", $DisplayName)
$manifestContent = $manifestContent.Replace("{{PUBLISHER_DISPLAY_NAME}}", $PublisherDisplayName)

$manifestDest = Join-Path $layoutDir "AppxManifest.xml"
Set-Content -Path $manifestDest -Value $manifestContent -Encoding Utf8
Write-Host "Generated AppxManifest.xml successfully."

# Ensure output directory exists
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$outputMsix = Join-Path $OutputDir "Spitit_${cleanVer}_x64.msix"
if (Test-Path $outputMsix) {
    Remove-Item -Path $outputMsix -Force
}

# Run makeappx pack
Write-Host "Packing MSIX with makeappx..."
& $makeAppx pack /d $layoutDir /p $outputMsix /nv /o
if ($LASTEXITCODE -ne 0) {
    Write-Error "makeappx failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

# Clean layout folder
Remove-Item -Path $layoutDir -Recurse -Force

if (Test-Path $outputMsix) {
    $size = (Get-Item $outputMsix).Length
    Write-Host "MSIX Package built successfully: $outputMsix ($([math]::Round($size / 1MB, 2)) MB)"
} else {
    Write-Error "MSIX output file was not created!"
    exit 1
}
