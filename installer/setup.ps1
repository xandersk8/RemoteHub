# setup.ps1 - Automated Dependency and Service Installer for RemoteHub-PC
# This script is intended to be run by Inno Setup after files are copied.

$ErrorActionPreference = "Stop"
$AppName = "RemoteHub-PC"
$InstallDir = $PSScriptRoot
$ServerDir = Join-Path $InstallDir "server"

Write-Host "--- $AppName Setup ---" -ForegroundColor Cyan

# 1. Check for Administrative Rights
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Este instalador precisa ser executado como ADMINISTRADOR."
    exit 1
}

# 2. Check for VC++ Redistributable (Required for SQLite3)
Write-Host "Verificando dependências do sistema..."
$vcRedist = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" -ErrorAction SilentlyContinue
if (-not $vcRedist) {
    Write-Host "Instalando Microsoft Visual C++ 2015-2022 Redistributable..." -ForegroundColor Yellow
    $url = "https://aka.ms/vs/17/release/vc_red_redist.x64.exe"
    $output = "$env:TEMP\vc_redist.x64.exe"
    Invoke-WebRequest -Uri $url -OutFile $output
    Start-Process -FilePath $output -ArgumentList "/install", "/quiet", "/norestart" -Wait
    Write-Host "VC++ Redistributable instalado." -ForegroundColor Green
}
else {
    Write-Host "VC++ Redistributable: OK" -ForegroundColor Green
}

# 3. Check for Node.js
$nodeInstalled = $false
try {
    $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
    if ($nodePath) {
        $nodeVersion = node -v
        Write-Host "Node.js detectado: $nodeVersion" -ForegroundColor Green
        $nodeInstalled = $true
    }
    else { throw "Node not found" }
}
catch {
    Write-Host "Node.js não encontrado. Instalando..." -ForegroundColor Yellow
    $url = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
    $output = "$env:TEMP\node-v20.msi"
    Invoke-WebRequest -Uri $url -OutFile $output
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$output`"", "/quiet", "/norestart" -Wait
    
    # Reload environment variables for the current session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Host "Node.js instalado com sucesso." -ForegroundColor Green
    $nodeInstalled = $true
}

if (-not $nodeInstalled) {
    Write-Error "Falha ao garantir que o Node.js está instalado."
    exit 1
}

# 4. Install NPM dependencies
Write-Host "Limpando cache e instalando dependências do NPM..."
Set-Location -Path $ServerDir
# Remove previous node_modules if any
if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }

& npm install --production --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Falha no npm install --production. Tentando normal..."
    & npm install
}

# 5. Setup Windows Service
Write-Host "Configurando o serviço do Windows..."
$serviceName = "RemoteHubPC"
$nodeExe = (Get-Command node).Source

# Uninstall if exists to avoid conflicts
if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
    Write-Host "Atualizando serviço existente..."
    Stop-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (Test-Path "uninstall-service.js") { & node uninstall-service.js }
}

if (Test-Path "install-service.js") {
    & node install-service.js
}
else {
    Write-Warning "install-service.js não encontrado. Usando New-Service..."
    $serverPath = Join-Path $ServerDir "server.js"
    New-Service -Name $serviceName -BinaryPathName "`"$nodeExe`" `"$serverPath`"" -DisplayName "Remote Hub PC Controller" -Description "Remote Shutdown and Wake on LAN Controller" -StartupType Automatic
    Start-Service -Name $serviceName
}

Write-Host "`nConfiguração concluída com sucesso!" -ForegroundColor Green
Write-Host "O RemoteHub-PC agora está pronto para uso."
