param(
    [string]$Version = "3.0.0",
    [string]$PackageName = "VikasNath.Spitit",
    [string]$Publisher = "CN=0AE03DC8-0A8C-4F03-A557-E8A19893C1E6",
    [string]$PublisherDisplayName = "VikasNath",
    [string]$DisplayName = "Spitit",
    [string]$ExePath = "",
    [string]$OutputDir = "release-artifacts",
    [string]$PfxPath = "",
    [string]$PfxPassword = "",
    [switch]$SkipSign = $false
)

$ErrorActionPreference = "Stop"

Write-Host "=== Spitit MSIX Packaging Script ==="
Write-Host "Version: $Version"
Write-Host "Package Name: $PackageName"
Write-Host "Publisher: $Publisher"
Write-Host "Publisher Display Name: $PublisherDisplayName"

# Locate makeappx.exe from Windows SDK
$makeAppx = ""
$signTool = ""

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

# Locate signtool.exe from Windows SDK
$signCommand = Get-Command signtool.exe -ErrorAction SilentlyContinue
if ($signCommand) {
    $signTool = $signCommand.Source
} elseif ($makeAppx) {
    $candidate = Join-Path (Split-Path $makeAppx) "signtool.exe"
    if (Test-Path $candidate) {
        $signTool = $candidate
    }
}

if (-not $signTool -or -not (Test-Path $signTool)) {
    $sdkPaths = @(
        "C:\Program Files (x86)\Windows Kits\10\bin",
        "C:\Program Files\Windows Kits\10\bin"
    )
    foreach ($path in $sdkPaths) {
        if (Test-Path $path) {
            $foundSign = Get-ChildItem -Path $path -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -like "*x64*" } |
                Select-Object -First 1
            if ($foundSign) {
                $signTool = $foundSign.FullName
                break
            }
        }
    }
}

if ($signTool) {
    Write-Host "Found signtool.exe at: $signTool"
} else {
    Write-Warning "signtool.exe not found in Windows Kits SDK."
}

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
[System.IO.File]::WriteAllText($manifestDest, $manifestContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "Generated AppxManifest.xml successfully."

# Guarantee signing certificate subject exactly matches manifest Publisher attribute
if ($manifestContent -match 'Publisher="([^"]+)"') {
    $Publisher = $matches[1]
    Write-Host "Aligned Signing Certificate Subject to Manifest Publisher: $Publisher"
}

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
    Write-Host "makeappx failed with exit code $LASTEXITCODE. Displaying manifest contents for debugging:"
    Get-Content $manifestDest | ForEach-Object { Write-Host $_ }
    Write-Error "makeappx failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

# Clean layout folder
Remove-Item -Path $layoutDir -Recurse -Force

if (-not (Test-Path $outputMsix)) {
    Write-Error "MSIX output file was not created!"
    exit 1
}

$size = (Get-Item $outputMsix).Length
Write-Host "MSIX Package packed: $outputMsix ($([math]::Round($size / 1MB, 2)) MB)"

# Digitally sign MSIX package
if (-not $SkipSign) {
    if ($signTool -and (Test-Path $signTool)) {
        Write-Host "=== Digitally Signing MSIX Package ==="
        $cerOutput = Join-Path $OutputDir "Spitit_${cleanVer}_cert.cer"

        if ($PfxPath -and (Test-Path $PfxPath)) {
            Write-Host "Signing MSIX with provided PFX: $PfxPath"
            if ($PfxPassword) {
                & $signTool sign /fd SHA256 /f $PfxPath /p $PfxPassword $outputMsix
            } else {
                & $signTool sign /fd SHA256 /f $PfxPath $outputMsix
            }
        } else {
            Write-Host "No custom PFX certificate provided. Generating self-signed signing certificate for '$Publisher'..."
            $cert = New-SelfSignedCertificate `
                -Type Custom `
                -Subject $Publisher `
                -KeyUsage DigitalSignature `
                -FriendlyName "Spitit App Package Signing" `
                -CertStoreLocation "Cert:\CurrentUser\My" `
                -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")

            # Export companion public certificate (.cer) for installation into Trusted Root
            Export-Certificate -Cert $cert -FilePath $cerOutput -Force | Out-Null
            Write-Host "Exported companion public certificate: $cerOutput"

            # Export temporary PFX for reliable SignTool invocation
            $tempPfx = Join-Path $OutputDir "temp_signing.pfx"
            $tempSecret = [System.Guid]::NewGuid().ToString()
            $secureSecret = ConvertTo-SecureString $tempSecret -AsPlainText -Force
            Export-PfxCertificate -Cert $cert -FilePath $tempPfx -Password $secureSecret | Out-Null

            Write-Host "Signing MSIX with signtool.exe..."
            & $signTool sign /fd SHA256 /f $tempPfx /p $tempSecret $outputMsix
            $signExitCode = $LASTEXITCODE

            # Securely remove temporary PFX file
            if (Test-Path $tempPfx) {
                Remove-Item -Path $tempPfx -Force
            }

            # Clean temporary cert from CurrentUser store
            if ($cert -and $cert.Thumbprint) {
                Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force -ErrorAction SilentlyContinue
            }

            if ($signExitCode -ne 0) {
                Write-Error "signtool failed to sign the MSIX package (Exit code: $signExitCode)."
                exit $signExitCode
            }
        }

        Write-Host "MSIX package signed successfully! Digital signature is attached."
    } else {
        Write-Warning "signtool.exe not found in Windows SDK. MSIX remains unsigned."
    }
} else {
    Write-Host "SkipSign specified. MSIX package left unsigned."
}

# Copy companion certificate installer helper if available
$installerHelper = Join-Path $PSScriptRoot "install-certificate.ps1"
if (Test-Path $installerHelper) {
    Copy-Item -Path $installerHelper -Destination (Join-Path $OutputDir "install-certificate.ps1") -Force
}

Write-Host "MSIX build and package process completed successfully."
