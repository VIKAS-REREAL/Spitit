<#
.SYNOPSIS
    Installs the Spitit developer public certificate into the Windows Trusted Root Certification Authorities store.
.DESCRIPTION
    Allows sideloading and installing the Spitit MSIX package on Windows 10/11 without certificate verification errors (0x800B010A).
#>

# Elevate to Administrator if not already elevated
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Requesting Administrator privileges to install root certificate..." -ForegroundColor Yellow
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$ErrorActionPreference = "Stop"

Write-Host "=== Spitit Certificate Installer ===" -ForegroundColor Cyan

# Find .cer file in current directory or script directory
$searchDirs = @($PSScriptRoot, (Get-Location).Path)
$cerFile = $null

foreach ($dir in $searchDirs) {
    if (Test-Path $dir) {
        $found = Get-ChildItem -Path $dir -Filter "*cert.cer" -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $found) {
            $found = Get-ChildItem -Path $dir -Filter "*.cer" -ErrorAction SilentlyContinue | Select-Object -First 1
        }
        if ($found) {
            $cerFile = $found.FullName
            break
        }
    }
}

if (-not $cerFile) {
    Write-Host "Error: No .cer certificate file found in current folder." -ForegroundColor Red
    Write-Host "Make sure the companion Spitit_cert.cer file is in the same folder as this script." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Found certificate: $cerFile" -ForegroundColor Cyan
Write-Host "Installing to 'Local Machine -> Trusted Root Certification Authorities'..." -ForegroundColor Cyan

try {
    Import-Certificate -FilePath $cerFile -CertStoreLocation "Cert:\LocalMachine\Root" | Out-Null
    Write-Host ""
    Write-Host "SUCCESS: Spitit certificate installed and trusted!" -ForegroundColor Green
    Write-Host "You can now double-click your .msix file to install Spitit." -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Failed to install certificate: $_" -ForegroundColor Red
}

Read-Host "Press Enter to finish"
