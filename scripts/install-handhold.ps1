# Cross-platform Handhold installer for Windows.
# End-user: downloads the latest release, checks optional deps, installs MSI.
# Dev mode: -Dev flag installs Rust, Bun, Visual Studio Build Tools.
#
# Usage (end-user):
#   irm https://raw.githubusercontent.com/dutch-casa/handhold/main/scripts/install-handhold.ps1 | iex
#
# Usage (developer — must download the script first):
#   .\scripts\install-handhold.ps1 -Dev
#
# Note: piped iex mode runs non-interactively (auto-accepts defaults).
# For interactive prompts, download and run the script directly.

$ErrorActionPreference = "Stop"

# ── ANSI + platform + header (print immediately, before any function defs) ──

$ESC = [char]27
$CheckMark = [char]0x2713
$CrossMark = [char]0x2717
$Arrow     = [char]0x25B8
$Bullet    = [char]0x2022
$HLine     = [string][char]0x2500
$EmDash    = [char]0x2014

$script:Green  = "$ESC[32m"
$script:Red    = "$ESC[31m"
$script:Yellow = "$ESC[33m"
$script:Bold   = "$ESC[1m"
$script:Dim    = "$ESC[2m"
$script:NC     = "$ESC[0m"

try {
    $kernel32 = Add-Type -MemberDefinition @"
[DllImport("kernel32.dll", SetLastError = true)]
public static extern IntPtr GetStdHandle(int nStdHandle);
[DllImport("kernel32.dll", SetLastError = true)]
public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);
[DllImport("kernel32.dll", SetLastError = true)]
public static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);
"@ -Name "Kernel32VT" -Namespace "Win32" -PassThru -ErrorAction SilentlyContinue

    $hOut = $kernel32::GetStdHandle(-11)
    $mode = 0
    $null = $kernel32::GetConsoleMode($hOut, [ref]$mode)
    $null = $kernel32::SetConsoleMode($hOut, ($mode -bor 0x0004))
} catch {
    $script:Green = ""; $script:Red = ""; $script:Yellow = ""
    $script:Bold = ""; $script:Dim = ""; $script:NC = ""
}

$script:Arch = $env:PROCESSOR_ARCHITECTURE
$script:ArchTag = switch ($script:Arch) {
    "AMD64" { "x64" }
    "ARM64" { "arm64" }
    default {
        Write-Host "`n  $($script:Red)${CrossMark} Unsupported architecture: $($script:Arch)$($script:NC)`n"
        exit 1
    }
}

$script:PlatformLabel = "Windows ($($script:ArchTag))"

# Header prints NOW — user sees output immediately.
Write-Host ""
Write-Host "  $($script:Bold)Handhold Installer$($script:NC)"
Write-Host "  $($HLine * 26)"
Write-Host ""
Write-Host "  $($script:Dim)Platform$($script:NC)    $($script:PlatformLabel)"

# ── Main installer function ─────────────────────────────────────────────

function Install-Handhold {
    param(
        [switch]$Dev
    )

    $Repo = "dutch-casa/handhold"
    $AppName = "Handhold"

    # Aliases for readability inside the function
    $Green = $script:Green; $Red = $script:Red; $Yellow = $script:Yellow
    $Bold = $script:Bold; $Dim = $script:Dim; $NC = $script:NC

    function Write-Ok   ($msg) { Write-Host "    ${Green}${CheckMark}${NC} $msg" }
    function Write-Warn ($msg) { Write-Host "    ${Yellow}~${NC} $msg" }
    function Write-Fail ($msg) { Write-Host "    ${Red}${CrossMark}${NC} $msg" }
    function Write-Info ($msg) { Write-Host "`n  ${Bold}$msg${NC}" }

    function Exit-Fatal ($msg) {
        Write-Host "`n  ${Red}${CrossMark} $msg${NC}`n"
        exit 1
    }

    $Interactive = $true
    try {
        if ([Console]::IsInputRedirected) { $Interactive = $false }
    } catch {
        $Interactive = $false
    }

    function Read-YesNo ($msg, $default = "y") {
        if (-not $Interactive) { return ($default -eq "y") }
        $hint = if ($default -eq "y") { "[Y/n]" } else { "[y/N]" }
        Write-Host "`n  ${Bold}${Arrow}${NC} $msg $hint " -NoNewline
        $answer = Read-Host
        if ([string]::IsNullOrWhiteSpace($answer)) { $answer = $default }
        return $answer -match "^[Yy]"
    }

    function Read-Choice ($msg, [string[]]$options) {
        if (-not $Interactive) { return 1 }
        Write-Host "`n  ${Bold}${Arrow}${NC} $msg"
        for ($i = 0; $i -lt $options.Count; $i++) {
            Write-Host "    ${Bold}$($i + 1))${NC} $($options[$i])"
        }
        Write-Host "  ${Dim}Enter choice [1-$($options.Count)]:${NC} " -NoNewline
        $choice = Read-Host
        if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }
        return [int]$choice
    }

    # ── Check admin elevation ───────────────────────────────────────────

    $IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator
    )

    # ── Winget availability ─────────────────────────────────────────────

    $HasWinget = $null -ne (Get-Command winget -ErrorAction SilentlyContinue)

    function Install-ViaWinget ($id, $name) {
        if (-not $HasWinget) {
            Write-Fail "$name ${EmDash} winget not available. Install manually."
            return $false
        }
        Write-Host "    ${Dim}Installing $name via winget...${NC}"
        winget install --id $id --accept-source-agreements --accept-package-agreements --silent
        return $?
    }

    # ── Dependency checks ───────────────────────────────────────────────

    $script:SkippedDeps = @()

    function Test-Git {
        $git = Get-Command git -ErrorAction SilentlyContinue
        if ($git) {
            $ver = (git --version) -replace "git version ", ""
            Write-Ok "Git $ver"
        } else {
            Write-Warn "Git ${EmDash} not found"
            if (Read-YesNo "Install Git?") {
                if (Install-ViaWinget "Git.Git" "Git") {
                    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
                    Write-Ok "Git installed"
                } else {
                    Write-Fail "Git install failed. Get it from https://git-scm.com/download/win"
                    $script:SkippedDeps += "Git"
                }
            } else {
                $script:SkippedDeps += "Git"
            }
        }
    }

    function Test-ContainerRuntime {
        $podman = Get-Command podman -ErrorAction SilentlyContinue
        $docker = Get-Command docker -ErrorAction SilentlyContinue

        if ($podman) {
            $ver = (podman --version) -replace "podman version ", ""
            Write-Ok "Podman $ver"
            return
        }
        if ($docker) {
            $ver = ((docker --version) -split " ")[2] -replace ",", ""
            Write-Ok "Docker $ver"
            return
        }

        Write-Warn "Container runtime ${EmDash} not found ${Dim}(needed for labs only)${NC}"

        if (Read-YesNo "Install a container runtime? (labs need Docker or Podman)" "n") {
            $choice = Read-Choice "Which container runtime?" @("Podman (recommended)", "Docker")
            switch ($choice) {
                1 {
                    if (Install-ViaWinget "RedHat.Podman" "Podman") {
                        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
                        Write-Ok "Podman installed"
                    } else {
                        Write-Fail "Install Podman manually: https://podman.io/docs/installation"
                        $script:SkippedDeps += "Container runtime (Docker/Podman)"
                    }
                }
                2 {
                    if (Install-ViaWinget "Docker.DockerDesktop" "Docker Desktop") {
                        Write-Ok "Docker Desktop installed ${EmDash} launch it to finish setup"
                    } else {
                        Write-Fail "Install Docker manually: https://docs.docker.com/desktop/install/windows-install/"
                        $script:SkippedDeps += "Container runtime (Docker/Podman)"
                    }
                }
            }
        } else {
            $script:SkippedDeps += "Container runtime (Docker/Podman)"
        }
    }

    Write-Info "Checking dependencies..."

    Test-Git
    Test-ContainerRuntime

    # ── Dev mode deps ───────────────────────────────────────────────────

    if ($Dev) {
        Write-Info "Checking dev dependencies..."

        $rustc = Get-Command rustc -ErrorAction SilentlyContinue
        if ($rustc) {
            $ver = ((rustc --version) -split " ")[1]
            Write-Ok "Rust $ver"
        } else {
            Write-Warn "Rust ${EmDash} not found"
            if (Read-YesNo "Install Rust via rustup?") {
                Write-Host "    ${Dim}Downloading rustup-init.exe...${NC}"
                $rustupPath = "$env:TEMP\rustup-init.exe"
                Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $rustupPath
                Start-Process -FilePath $rustupPath -ArgumentList "-y" -Wait
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
                $env:Path += ";$env:USERPROFILE\.cargo\bin"
                Write-Ok "Rust installed"
            } else {
                Exit-Fatal "Rust is required for dev mode."
            }
        }

        $bun = Get-Command bun -ErrorAction SilentlyContinue
        if ($bun) {
            Write-Ok "Bun $(bun --version)"
        } else {
            Write-Warn "Bun ${EmDash} not found"
            if (Read-YesNo "Install Bun?") {
                irm bun.sh/install.ps1 | iex
                $env:Path += ";$env:USERPROFILE\.bun\bin"
                Write-Ok "Bun installed"
            } else {
                Exit-Fatal "Bun is required for dev mode."
            }
        }

        $cl = Get-Command cl -ErrorAction SilentlyContinue
        if ($cl) {
            Write-Ok "Visual Studio C++ Build Tools"
        } else {
            Write-Warn "Visual Studio C++ Build Tools ${EmDash} not found"
            Write-Host "    Install from: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
            Write-Host "    Select 'Desktop development with C++' workload."
        }

        $tauriInstalled = (cargo install --list 2>$null) -match "^tauri-cli"
        if ($tauriInstalled) {
            Write-Ok "Tauri CLI"
        } else {
            Write-Host "    ${Dim}Installing Tauri CLI...${NC}"
            cargo install tauri-cli --version "^2" --locked
            Write-Ok "Tauri CLI"
        }
    }

    # ── Fetch latest release ────────────────────────────────────────────

    Write-Info "Fetching latest release..."

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $releaseJson = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
    } catch {
        Exit-Fatal "Failed to fetch release info. Check your internet connection."
    }

    $Version = $releaseJson.tag_name
    if ([string]::IsNullOrWhiteSpace($Version)) {
        Exit-Fatal "No releases found."
    }

    $VerNum = $Version -replace "^v", ""
    Write-Host "  ${Dim}Version${NC}     $Version"

    # ── Resolve asset ───────────────────────────────────────────────────

    $AssetName = "Handhold_${VerNum}_$($script:ArchTag)_en-US.msi"
    $asset = $releaseJson.assets | Where-Object { $_.name -eq $AssetName }

    if (-not $asset) {
        $AssetName = "Handhold_${VerNum}_$($script:ArchTag)-setup.exe"
        $asset = $releaseJson.assets | Where-Object { $_.name -eq $AssetName }
    }

    if (-not $asset) {
        Exit-Fatal "No installer found for Windows $($script:ArchTag) in release $Version.`n  Check: https://github.com/$Repo/releases/tag/$Version"
    }

    $DownloadUrl = $asset.browser_download_url
    $Dest = Join-Path $env:TEMP $AssetName

    # ── Download with progress ──────────────────────────────────────────

    Write-Info "Downloading $AssetName..."

    try {
        $request = [System.Net.HttpWebRequest]::Create($DownloadUrl)
        $request.UserAgent = "Handhold-Installer"
        $webResponse = $request.GetResponse()
        $totalBytes = $webResponse.ContentLength
        $stream = $webResponse.GetResponseStream()
        $fileStream = [System.IO.File]::Create($Dest)
        $buffer = New-Object byte[] 65536
        $bytesRead = 0
        $totalRead = 0
        $lastPct = -1

        while (($bytesRead = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $fileStream.Write($buffer, 0, $bytesRead)
            $totalRead += $bytesRead
            if ($totalBytes -gt 0) {
                $pct = [math]::Floor($totalRead * 100 / $totalBytes)
                if ($pct -ne $lastPct) {
                    $lastPct = $pct
                    $filled = [math]::Floor($pct / 4)
                    $empty = 25 - $filled
                    $bar = ([string][char]0x2588) * $filled + ([string][char]0x2591) * $empty
                    $mb = [math]::Round($totalRead / 1MB, 0)
                    $totalMb = [math]::Round($totalBytes / 1MB, 0)
                    Write-Host "`r    $bar  ${pct}%  ${mb} MB / ${totalMb} MB" -NoNewline
                }
            }
        }
        Write-Host ""
    } catch {
        Exit-Fatal "Download failed: $_"
    } finally {
        if ($fileStream) { $fileStream.Close() }
        if ($stream) { $stream.Close() }
        if ($webResponse) { $webResponse.Close() }
    }

    $fileSizeMb = [math]::Round((Get-Item $Dest).Length / 1MB, 1)
    Write-Ok "Downloaded (${fileSizeMb} MB)"

    # ── Install ─────────────────────────────────────────────────────────

    Write-Info "Installing..."

    if ($AssetName -match "\.msi$") {
        $msiArgs = "/i `"$Dest`" /quiet /norestart"
        Write-Host "    ${Dim}Running MSI installer...${NC}"

        $startArgs = @{
            FilePath     = "msiexec.exe"
            ArgumentList = $msiArgs
            Wait         = $true
            PassThru     = $true
        }
        if (-not $IsAdmin) {
            Write-Host "    ${Dim}Requesting administrator privileges...${NC}"
            $startArgs["Verb"] = "RunAs"
        }
        $process = Start-Process @startArgs

        if ($process.ExitCode -ne 0) {
            Exit-Fatal "MSI install failed (exit code $($process.ExitCode)). Try running the installer manually."
        }
        Remove-Item $Dest -Force -ErrorAction SilentlyContinue
        Write-Ok "Installed $AppName"
    } elseif ($AssetName -match "\.exe$") {
        Write-Host "    ${Dim}Running installer...${NC}"
        $startArgs = @{
            FilePath     = $Dest
            ArgumentList = "/S"
            Wait         = $true
            PassThru     = $true
        }
        if (-not $IsAdmin) {
            Write-Host "    ${Dim}Requesting administrator privileges...${NC}"
            $startArgs["Verb"] = "RunAs"
        }
        $process = Start-Process @startArgs

        if ($process.ExitCode -ne 0) {
            Exit-Fatal "Install failed (exit code $($process.ExitCode)). Try running the installer manually."
        }
        Remove-Item $Dest -Force -ErrorAction SilentlyContinue
        Write-Ok "Installed $AppName"
    }

    # ── Dev mode post-install ───────────────────────────────────────────

    if ($Dev) {
        Write-Info "Setting up dev environment..."

        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        if ([string]::IsNullOrWhiteSpace($scriptDir)) {
            Write-Warn "Dev mode requires running the script directly, not via pipe."
            Write-Host "      Download: ${Bold}Invoke-WebRequest -Uri `"https://raw.githubusercontent.com/dutch-casa/handhold/main/scripts/install-handhold.ps1`" -OutFile install-handhold.ps1${NC}"
            Write-Host "      Then run: ${Bold}.\install-handhold.ps1 -Dev${NC}"
        } else {
            $projectRoot = Split-Path -Parent $scriptDir

            if (Test-Path (Join-Path $projectRoot "package.json")) {
                Write-Host "    ${Dim}Installing frontend dependencies...${NC}"
                Push-Location $projectRoot
                bun install
                Write-Ok "bun install"

                Write-Host "    ${Dim}Downloading sidecar binaries...${NC}"
                $bashCmd = Get-Command bash -ErrorAction SilentlyContinue
                if ($bashCmd) {
                    bash "$projectRoot/scripts/download-sidecars.sh"
                    Write-Ok "Sidecars downloaded"
                } else {
                    Write-Warn "bash not found ${EmDash} run scripts/download-sidecars.sh manually (Git Bash or WSL)."
                }

                Write-Host "    ${Dim}Verifying Rust build...${NC}"
                Push-Location (Join-Path $projectRoot "src-tauri")
                cargo check
                Write-Ok "cargo check passed"
                Pop-Location
                Pop-Location
            } else {
                Write-Warn "Not in the Handhold repo ${EmDash} skipping bun install / cargo check."
                Write-Host "      Clone the repo first: ${Bold}git clone https://github.com/$Repo.git${NC}"
                Write-Host "      Then run: ${Bold}.\scripts\install-handhold.ps1 -Dev${NC}"
            }
        }
    }

    # ── Done ────────────────────────────────────────────────────────────

    Write-Host ""
    Write-Host "  $($HLine * 26)"
    Write-Host "  ${Green}${Bold}Done!${NC}"
    Write-Host ""
    Write-Host "  Launch ${Bold}Handhold${NC} from the Start Menu or desktop shortcut."

    if ($script:SkippedDeps.Count -gt 0) {
        Write-Host ""
        Write-Host "  ${Yellow}Note:${NC} Skipped optional dependencies:"
        foreach ($dep in $script:SkippedDeps) {
            Write-Host "    ${Dim}${Bullet}${NC} $dep"
        }
        Write-Host "  Labs that need containers won't work until you install Docker or Podman."
    }

    if ($Dev) {
        Write-Host ""
        Write-Host "  Start developing:"
        Write-Host "    ${Bold}cd handhold; bun tauri dev${NC}"
    }

    Write-Host ""
}

# Invoke. irm | iex runs this immediately; direct invocation passes params through.
Install-Handhold @args
