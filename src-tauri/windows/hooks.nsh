; NSIS installer hook: require Git for Windows before installation proceeds.
;
; Checks both HKLM (system-wide) and HKCU (per-user) registry keys written by
; the official Git for Windows installer. Winget, Chocolatey, and Scoop all
; write the same keys when they install Git for Windows.
;
; Uses StrCmp for conditionals — LogicLib.nsh is not included by Tauri's
; installer.nsi template so ${If}/${EndIf} is unavailable here.

!macro NSIS_HOOK_PREINSTALL
  ; Check system-wide installation first (admin install).
  ReadRegStr $0 HKLM "SOFTWARE\GitForWindows" "InstallPath"
  StrCmp $0 "" 0 git_found   ; non-empty → Git found

  ; Check per-user installation (no admin rights required).
  ReadRegStr $0 HKCU "SOFTWARE\GitForWindows" "InstallPath"
  StrCmp $0 "" 0 git_found   ; non-empty → Git found

  ; Git for Windows not found — prompt the user.
  MessageBox MB_YESNO|MB_ICONEXCLAMATION \
    "Handhold requires Git for Windows (which includes Git Bash).$\r$\n$\r$\nWould you like to open the download page now?" \
    IDNO abort_install

  ExecShell "open" "https://git-scm.com/download/win"

  abort_install:
    Abort "Installation aborted: Git for Windows is required. Please install it and re-run this installer."

  git_found:
!macroend
