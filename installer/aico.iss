; @implements spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-1::REQ-001
; @implements spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-1::REQ-002
; @implements spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-1::REQ-003
; @implements spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-1::REQ-009
; @implements spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-2::REQ-005
; @implements spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-2::REQ-006
; @implements spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-2::REQ-007
; @implements spec-ft-distribution-windows-installer::TASK-DISTRIBUTION-003-2::REQ-008
; @implements spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-2::REQ-003
; @implements spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-2::REQ-004
; @implements spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-2::REQ-006
; @implements spec-ft-distribution-prerequisite-provisioning::TASK-DISTRIBUTION-004-2::REQ-007
; @implements spec-ft-distribution-uninstaller::TASK-DISTRIBUTION-005-1::REQ-001
; @implements spec-ft-distribution-uninstaller::TASK-DISTRIBUTION-005-1::REQ-002
; @implements spec-ft-distribution-uninstaller::TASK-DISTRIBUTION-005-1::REQ-003
; @implements spec-ft-distribution-uninstaller::TASK-DISTRIBUTION-005-1::REQ-004

#ifndef AppVersion
  #define AppVersion "0.2.0"
#endif

#ifndef PayloadDir
  #define PayloadDir "dist\release\payload"
#endif

[Setup]
AppId={{8B1A0A3D-0F2C-4A2D-A48E-4545A1C00001}}
AppName=AICO
AppVersion={#AppVersion}
AppPublisher=AICO Contributors
AppPublisherURL=https://github.com/Lexer727/aico
AppSupportURL=https://github.com/Lexer727/aico/issues
AppUpdatesURL=https://github.com/Lexer727/aico/releases
DefaultDirName={%USERPROFILE}\aico
DisableDirPage=no
DirExistsWarning=no
UsePreviousAppDir=yes
PrivilegesRequired=lowest
SourceDir=..
OutputDir=dist\release
OutputBaseFilename=aico-setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
UninstallFilesDir={app}\.aico\bin
CreateUninstallRegKey=yes
UninstallDisplayName=AICO
SetupIconFile=installer\assets\aico.ico
UninstallDisplayIcon={app}\.aico\bin\aico.ico

[Dirs]
Name: "{app}\specs"
Name: "{app}\codebase"
Name: "{app}\.agents"
Name: "{app}\.aico"
Name: "{app}\.aico\storage"
Name: "{app}\.aico\logs"
Name: "{app}\.aico\bin"

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}\.aico\bin"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "installer\assets\aico.ico"; DestDir: "{app}\.aico\bin"; Flags: ignoreversion
Source: "installer\prerequisites.json"; DestDir: "{tmp}"; Flags: ignoreversion deleteafterinstall
Source: "installer\scripts\prereq-manager.ps1"; DestDir: "{tmp}"; Flags: ignoreversion deleteafterinstall
Source: "installer\scripts\release-check.ps1"; DestDir: "{tmp}"; Flags: ignoreversion deleteafterinstall

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "startmenu"; Description: "Create a &Start menu entry"; GroupDescription: "Additional shortcuts:"
Name: "addtopath"; Description: "Add AICO to user &PATH environment variable"; GroupDescription: "Environment:"; Flags: unchecked
Name: "launch"; Description: "&Launch AICO after installation"; GroupDescription: "Options:"

[Icons]
Name: "{userdesktop}\AICO"; Filename: "{app}\.aico\bin\aico-server.exe"; WorkingDir: "{app}"; IconFilename: "{app}\.aico\bin\aico.ico"; Tasks: desktopicon
Name: "{userprograms}\AICO\AICO"; Filename: "{app}\.aico\bin\aico-server.exe"; WorkingDir: "{app}"; IconFilename: "{app}\.aico\bin\aico.ico"; Tasks: startmenu
Name: "{userprograms}\AICO\Uninstall AICO"; Filename: "{app}\.aico\bin\unins000.exe"; Tasks: startmenu

[Run]
Filename: "{app}\.aico\bin\aico-server.exe"; WorkingDir: "{app}"; Description: "Launch AICO"; Flags: nowait postinstall skipifsilent; Tasks: launch

[Code]
var
  PrereqPage: TInputOptionWizardPage;
  PurgeDataOnUninstall: Boolean;

function SplitStringToItems(const S, Delim: String): TArrayOfString;
var
  P, LastP: Integer;
  Cnt: Integer;
begin
  LastP := 1;
  Cnt := 0;
  SetArrayLength(Result, 100);
  while True do
  begin
    P := Pos(Delim, Copy(S, LastP, Length(S) - LastP + 1));
    if P = 0 then
    begin
      Result[Cnt] := Copy(S, LastP, Length(S) - LastP + 1);
      Inc(Cnt);
      Break;
    end;
    Result[Cnt] := Copy(S, LastP, P - 1);
    Inc(Cnt);
    LastP := LastP + P;
  end;
  SetArrayLength(Result, Cnt);
end;

procedure KillRunningServer();
var
  ResultCode: Integer;
begin
  Exec('taskkill.exe', '/f /im aico-server.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  KillRunningServer();
  Result := '';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  StorageDir: String;
begin
  Result := True;
  if CurPageID = wpSelectDir then
  begin
    StorageDir := ExpandConstant('{app}\.aico\storage');
    if DirExists(StorageDir) then
    begin
      if not WizardSilent() then
      begin
        MsgBox('Existing AICO workspace detected at this location.' + #13#10 +
               'Your databases (.aico\storage), specs, and codebase repositories will be preserved.',
               mbInformation, MB_OK);
      end;
    end;
  end
  else if (PrereqPage <> nil) and (CurPageID = PrereqPage.ID) then
  begin
    if not PrereqPage.Values[0] then
    begin
      if not WizardSilent() then
      begin
        if MsgBox('Git is strongly recommended for AICO repository tracking and skill synchronization.' + #13#10 +
                  'Are you sure you want to proceed without Git?', mbConfirmation, MB_YESNO) = IDNO then
        begin
          Result := False;
          Exit;
        end;
      end;
    end;
  end;
end;

procedure InitializeWizard();
begin
  PrereqPage := CreateInputOptionPage(
    wpSelectDir,
    'Prerequisites & Developer Tool Provisioning',
    'Detect and optionally install recommended developer tools',
    'AICO works best when paired with Git and modern agent CLIs. Select the tools you would like to provision automatically via winget/npm:',
    False, False
  );
  PrereqPage.Add('Git (Required for version control and workspace tracking)');
  PrereqPage.Add('GitHub CLI (gh)');
  PrereqPage.Add('Node.js LTS');
  PrereqPage.Add('Claude Code CLI');
  PrereqPage.Add('Antigravity CLI');
  PrereqPage.Add('OpenAI Codex CLI');
  PrereqPage.Add('GitHub Copilot CLI');

  // Default checked for git
  PrereqPage.Values[0] := True;
end;

procedure AddToUserPath(PathToAdd: String);
var
  CurrentPath: String;
  NewPath: String;
begin
  if not RegQueryStringValue(HKCU, 'Environment', 'Path', CurrentPath) then
    CurrentPath := '';

  if Pos(Uppercase(PathToAdd), Uppercase(CurrentPath)) = 0 then
  begin
    if Length(CurrentPath) > 0 then
      NewPath := CurrentPath + ';' + PathToAdd
    else
      NewPath := PathToAdd;

    RegWriteStringValue(HKCU, 'Environment', 'Path', NewPath);
  end;
end;

procedure RemoveFromUserPath(PathToRemove: String);
var
  CurrentPath, UpperPath, UpperRemove: String;
  P: Integer;
begin
  if RegQueryStringValue(HKCU, 'Environment', 'Path', CurrentPath) then
  begin
    UpperPath := Uppercase(CurrentPath);
    UpperRemove := Uppercase(PathToRemove);
    P := Pos(';' + UpperRemove, UpperPath);
    if P > 0 then
    begin
      Delete(CurrentPath, P, Length(PathToRemove) + 1);
      RegWriteStringValue(HKCU, 'Environment', 'Path', CurrentPath);
    end
    else
    begin
      P := Pos(UpperRemove + ';', UpperPath);
      if P > 0 then
      begin
        Delete(CurrentPath, P, Length(PathToRemove) + 1);
        RegWriteStringValue(HKCU, 'Environment', 'Path', CurrentPath);
      end
      else if UpperPath = UpperRemove then
      begin
        RegWriteStringValue(HKCU, 'Environment', 'Path', '');
      end;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  BinDir: String;
  SelectedIds, ScriptPath, CatalogPath, Cmd: String;
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    BinDir := ExpandConstant('{app}\.aico\bin');
    if WizardIsTaskSelected('addtopath') then
    begin
      AddToUserPath(BinDir);
    end;

    // Provision selected developer tools
    if not WizardSilent() and (PrereqPage <> nil) then
    begin
      SelectedIds := '';
      if PrereqPage.Values[0] then SelectedIds := SelectedIds + 'git,';
      if PrereqPage.Values[1] then SelectedIds := SelectedIds + 'gh,';
      if PrereqPage.Values[2] then SelectedIds := SelectedIds + 'node,';
      if PrereqPage.Values[3] then SelectedIds := SelectedIds + 'claude-code,';
      if PrereqPage.Values[4] then SelectedIds := SelectedIds + 'antigravity,';
      if PrereqPage.Values[5] then SelectedIds := SelectedIds + 'codex,';
      if PrereqPage.Values[6] then SelectedIds := SelectedIds + 'copilot,';

      if Length(SelectedIds) > 0 then
      begin
        SetLength(SelectedIds, Length(SelectedIds) - 1);
        ScriptPath := ExpandConstant('{tmp}\prereq-manager.ps1');
        CatalogPath := ExpandConstant('{app}\.aico\bin\prerequisites.json');
        if not FileExists(CatalogPath) then
          CatalogPath := ExpandConstant('{tmp}\prerequisites.json');

        if FileExists(ScriptPath) and FileExists(CatalogPath) then
        begin
          Cmd := '-ExecutionPolicy Bypass -NoProfile -File "' + ScriptPath + '" -Action install -CatalogPath "' + CatalogPath + '" -Ids "' + SelectedIds + '"';
          Exec('powershell.exe', Cmd, '', SW_SHOWNORMAL, ewWaitUntilTerminated, ResultCode);
        end;
      end;
    end;
  end;
end;

function InitializeUninstall(): Boolean;
var
  PromptRes: Integer;
  I: Integer;
begin
  KillRunningServer();
  PurgeDataOnUninstall := False;

  for I := 1 to ParamCount do
  begin
    if CompareText(ParamStr(I), '/PURGEDATA') = 0 then
    begin
      PurgeDataOnUninstall := True;
      Break;
    end;
  end;

  if (not UninstallSilent()) and (not PurgeDataOnUninstall) then
  begin
    PromptRes := MsgBox('Do you also want to remove AICO database storage (.aico\storage), logs, and synced agent skills?' + #13#10#13#10 +
                        'Note: Your specs/ and codebase/ folders will NEVER be deleted.',
                        mbConfirmation, MB_YESNO or MB_DEFBUTTON2);
    if PromptRes = IDYES then
      PurgeDataOnUninstall := True;
  end;

  Result := True;
end;

procedure DeleteAicoSkills(const SkillsDir: String);
var
  FindRec: TFindRec;
begin
  if FindFirst(SkillsDir + '\aico-*', FindRec) then
  begin
    try
      repeat
        if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY <> 0) and
           (FindRec.Name <> '.') and (FindRec.Name <> '..') then
        begin
          DelTree(SkillsDir + '\' + FindRec.Name, True, True, True);
        end;
      until not FindNext(FindRec);
    finally
      FindClose(FindRec);
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  BinDir, StorageDir, LogsDir, AgentsDir: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    BinDir := ExpandConstant('{app}\.aico\bin');
    RemoveFromUserPath(BinDir);
  end
  else if CurUninstallStep = usPostUninstall then
  begin
    BinDir := ExpandConstant('{app}\.aico\bin');
    DelTree(BinDir, True, True, True);

    if PurgeDataOnUninstall then
    begin
      StorageDir := ExpandConstant('{app}\.aico\storage');
      LogsDir := ExpandConstant('{app}\.aico\logs');
      AgentsDir := ExpandConstant('{app}\.agents\skills');

      DelTree(StorageDir, True, True, True);
      DelTree(LogsDir, True, True, True);

      // Remove AICO-managed skills
      DeleteAicoSkills(AgentsDir);

      // Remove .aico container if empty
      RemoveDir(ExpandConstant('{app}\.aico'));
    end;
  end;
end;
