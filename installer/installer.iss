[Setup]
AppName=RemoteHub-PC
AppVersion=1.0
DefaultDirName={commonpf}\RemoteHub-PC
DefaultGroupName=RemoteHub-PC
UninstallDisplayIcon={app}\client\dist\icon.svg
Compression=lzma2
SolidCompression=yes
OutputDir=Output
OutputBaseFilename=RemoteHub-PC-Setup
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64

[Files]
; Copy server files (excluding node_modules as they will be installed by setup.ps1)
Source: "..\server\*"; DestDir: "{app}\server"; Flags: recursesubdirs createallsubdirs; Excludes: "node_modules\*, users.db, .env"
; Copy client dist files
Source: "..\client\dist\*"; DestDir: "{app}\client\dist"; Flags: recursesubdirs createallsubdirs
; Copy setup script
Source: "setup.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\setup.ps1"""; Flags: runascurrentuser waituntilterminated

[UninstallRun]
Filename: "node.exe"; Parameters: """{app}\server\uninstall-service.js"""; Flags: waituntilterminated RunHidden
Filename: "powershell.exe"; Parameters: "-Command ""Stop-Service -Name RemoteHubPC -ErrorAction SilentlyContinue; Remove-Service -Name RemoteHubPC -ErrorAction SilentlyContinue"""; Flags: waituntilterminated RunHidden

[Icons]
Name: "{group}\RemoteHub-PC"; Filename: "http://localhost:3080"
Name: "{group}\{cm:UninstallProgram,RemoteHub-PC}"; Filename: "{uninstallexe}"
