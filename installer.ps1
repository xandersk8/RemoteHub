# Self-Extracting / Installer Bootstrapper for RemoteHub-PC
# This script checks for dependencies and installs the service.

$AppName = "RemoteHub-PC"
$ExeName = "remote-hub.exe"
$SourceDir = $PSScriptRoot
$InstallDir = "$env:ProgramFiles\$AppName"

Write-Host "--- $AppName Installer ---" -ForegroundColor Cyan

# 1. Check for Administrative Rights
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Este instalador precisa ser executado como ADMINISTRADOR."
    Read-Host "Pressione Enter Para Sair..."
    exit
}

# 2. Check for dependencies (VC++ Redistributable - required for SQLite)
Write-Host "Verificando dependências do sistema..."
$vcRedist = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" -ErrorAction SilentlyContinue
if (-not $vcRedist) {
    Write-Host "Dependência ausente: Microsoft Visual C++ 2015-2022 Redistributable (x64)." -ForegroundColor Yellow
    Write-Host "Fazendo o download e instalando automaticamente..."
    $url = "https://aka.ms/vs/17/release/vc_redist.x64.exe"
    $output = "$env:TEMP\vc_redist.x64.exe"
    Invoke-WebRequest -Uri $url -OutFile $output
    Start-Process -FilePath $output -ArgumentList "/install", "/quiet", "/norestart" -Wait
    Write-Host "VC++ Redistributable instalado com sucesso." -ForegroundColor Green
}
else {
    Write-Host "Dependências do sistema: OK" -ForegroundColor Green
}

# 3. Prepare Installation Directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
}

# 4. Copy and Unblock Executable
Write-Host "Instalando arquivos do aplicativo..."
if (Test-Path "$SourceDir\dist\$ExeName") {
    Copy-Item "$SourceDir\dist\$ExeName" "$InstallDir\$ExeName" -Force
}
elseif (Test-Path "$SourceDir\$ExeName") {
    Copy-Item "$SourceDir\$ExeName" "$InstallDir\$ExeName" -Force
}
else {
    Write-Error "Arquivo $ExeName não encontrado em $SourceDir."
    Read-Host "Pressione Enter Para Sair..."
    exit
}

# Unblock the file to prevent Windows SmartScreen/SAC blocks
Unblock-File -Path "$InstallDir\$ExeName" -ErrorAction SilentlyContinue
Write-Host "Arquivo desbloqueado para execução." -ForegroundColor Gray

# 5. Install/Start Windows Service
Write-Host "Configurando serviço do Windows..."
# Note: We use the bundled exe as the service target
# Since node-windows logic is inside the exe, we can call it if implemented, 
# or use PowerShell to create the service directly.
$serviceName = "RemoteHubPC"
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($service) {
    Write-Host "Parando serviço existente..."
    Stop-Service -Name $serviceName -ErrorAction SilentlyContinue
}

# Using New-Service for a cleaner integration
try {
    if (-not $service) {
        New-Service -Name $serviceName -BinaryPathName "`"$InstallDir\$ExeName`"" -DisplayName "Remote Hub PC Controller" -Description "Remote Shutdown and Wake on LAN Controller" -StartupType Automatic
    }
    else {
        # Update binary path if needed
        sc.exe config $serviceName binPath= "`"$InstallDir\$ExeName`""
    }
    Start-Service -Name $serviceName
    Write-Host "Serviço instalado e iniciado com sucesso!" -ForegroundColor Green
}
catch {
    Write-Error "Falha ao instalar o serviço: $($_.Exception.Message)"
}

Write-Host "`nInstalação concluída!" -ForegroundColor Cyan
Write-Host "O servidor está rodando na porta 3080 (se padrão)."
Write-Host "Você pode acessar em http://localhost:3080"
Read-Host "`nPressione Enter para sair..."
