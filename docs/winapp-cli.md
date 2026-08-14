# Windows App Development CLI Guide

This document provides a comprehensive guide to using the Windows App Development CLI (winapp) with the WinDev Helper extension.

> **Note:** This guide covers winapp CLI v0.3.0 and later, including the v0.5.0 UI automation additions. See [Breaking Changes](#breaking-changes) for migration notes.

## Overview

The Windows App Development CLI (winapp) is a command-line tool that simplifies Windows app development tasks. It provides commands for:

- Project initialization and setup
- Package management
- MSIX packaging and signing
- Certificate generation and management
- App manifest handling
- Debug identity creation
- **Microsoft Store publishing** (v0.2.0+)
- **External catalog management** (v0.2.0+)
- **Run packaged apps** from build output (v0.3.0+)
- **UI Automation** — inspect, interact with, screenshot, and record running apps (v0.3.0+; expanded in v0.5.0)
- **App execution aliases** — launch packaged apps by name (v0.3.0+)
- **Shell completion** for all commands (v0.3.0+)
- **`dotnet run` support** for packaged .NET apps (v0.3.0+)

## Installation

### Using Windows Package Manager (winget)

```bash
winget install Microsoft.WinAppCli
```

### Manual Installation

Download from [github.com/microsoft/WinAppCli](https://github.com/microsoft/WinAppCli)

### Verify Installation

```bash
winapp --version
```

Or use the VS Code command: **WinUI: Check WinApp CLI Installation**

## CLI Commands

### Setup Commands

#### winapp init

Initialize a project with Windows SDK and App SDK references.

```bash
winapp init [project-path]
```

**VS Code command:** WinUI: Initialize Project with Windows SDK

> **v0.4.0:** `init` adds JS/TS WinRT binding support and expects an explicit base directory when using non-interactive defaults (`--no-prompt` / `--use-defaults`). WinDev Helper now passes a directory automatically in non-interactive mode.

> **v0.2.0 Breaking Change:** `init` no longer generates a certificate automatically. Run `winapp cert generate` explicitly when you need a dev signing certificate.
>
> **v0.2.0 .NET Projects:** When `winapp init` detects a `.csproj`, it configures NuGet packages in the project file directly instead of creating a `winapp.yaml`.

---

#### winapp new (v0.6.0+)

Create a WinUI app from an official Windows App SDK template. It installs or updates the official template pack as needed.

```bash
winapp new --template winui-mvvm --name MyWinUIApp --output ./MyWinUIApp --use-defaults
```

WinDev Helper continues to provide its own **WinDev: Create WinUI Project** workflow because it supports both official and community template sources. Use `winapp new` directly when you want the CLI's official-template-only flow.

---

#### winapp restore

Restore packages and dependencies for the project.

```bash
winapp restore [project-path]
```

**VS Code command:** WinUI: Restore Packages

The VS Code command runs `dotnet restore <project.csproj>` when a .NET project is detected. It invokes `winapp restore` only for non-.NET workspaces configured with `winapp.yaml`.

> **v0.2.0 Note:** winapp now uses the NuGet global cache for packages instead of `%userprofile%/.winapp/packages`. This avoids duplicate downloads if you already have packages cached.

---

#### winapp update

Update packages and dependencies to their latest versions.

```bash
winapp update [project-path]
```

**VS Code command:** WinUI: Update Packages

---

### App Identity & Debugging

#### winapp create-debug-identity

Add a temporary app identity for debugging packaged apps. This is useful when you need package identity without creating a full MSIX package.

```bash
winapp create-debug-identity [project-path]
```

**VS Code command:** WinUI: Create Debug Identity

**Use cases:**

- Testing APIs that require package identity
- Debugging without full MSIX packaging
- Local development of packaged apps

---

#### winapp manifest

Generate and manage AppxManifest.xml files.

```bash
# Generate a new manifest
winapp manifest generate [project-path]

# Validate an existing manifest
winapp manifest validate [manifest-path]
```

**VS Code command:** WinUI: Generate App Manifest

---

### MSIX Packaging

#### winapp package

Create MSIX packages from directories.

```bash
winapp package -i <input-directory> -o <output-path> -m <manifest-path>
```

**Options:**

| Option | Description |
|--------|-------------|
| `-i, --input` | Input directory containing app files |
| `-o, --output` | Output path for the MSIX package |
| `-m, --manifest` | Path to the AppxManifest.xml file |

**VS Code command:** WinUI: Create MSIX Package

**Example:**

```bash
winapp package -i ./publish -o ./dist/MyApp.msix -m ./Package.appxmanifest
```

---

### Certificates & Signing

#### winapp cert

Generate, install, and inspect development certificates.

```bash
# Generate a new certificate
winapp cert generate -n <subject-name> -o <output-path> -p <password>

# Generate with public key export (v0.2.1+)
winapp cert generate -n <subject-name> -o <output-path> -p <password> --export-cer

# View certificate info (v0.2.1+)
winapp cert info <cert-path> --password <password>

# Install a certificate
winapp cert install <certificate-path>
```

**Options for generate:**

| Option | Description |
|--------|-------------|
| `-n, --name` | Certificate subject name (e.g., CN=MyCompany) |
| `-o, --output` | Output path for the .pfx file |
| `-p, --password` | Password for the certificate |
| `--export-cer` | Export public key as a .cer file (v0.2.1+) |
| `--json` | Output in JSON format (v0.2.1+) |

**Options for info:**

| Option | Description |
|--------|-------------|
| `--password` | Certificate password |
| `--json` | Output in JSON format |

**VS Code commands:**

- WinUI: Generate Development Certificate
- WinUI: View Certificate Info
- WinUI: Install Certificate

**Example:**

```bash
# Generate a development certificate
winapp cert generate -n "CN=My Development" -o ./DevCert.pfx -p MyPassword123

# Install the certificate
winapp cert install ./DevCert.pfx
```

---

#### winapp sign

Sign MSIX packages and executables.

```bash
winapp sign -i <input-path> -c <certificate-path> -p <password> [-t <timestamp-url>]
```

**Options:**

| Option | Description |
|--------|-------------|
| `-i, --input` | Path to the file to sign |
| `-c, --cert` | Path to the certificate file |
| `-p, --password` | Certificate password |
| `-t, --timestamp` | Timestamp server URL (recommended) |

**VS Code command:** WinUI: Sign Package

**Example:**

```bash
winapp sign -i ./dist/MyApp.msix -c ./DevCert.pfx -p MyPassword123 -t http://timestamp.digicert.com
```

---

### Development Tools

#### winapp tool

Access Windows SDK tools.

```bash
winapp tool <tool-name> [arguments]
```

**Available tools:**

- makeappx
- signtool
- makepri
- And other Windows SDK tools

**Example:**

```bash
winapp tool makeappx pack /d ./publish /p ./MyApp.msix
```

---

#### winapp get-winapp-path

Get paths to installed SDK components.

```bash
winapp get-winapp-path
```

**Output includes:**

- Windows SDK path
- Windows App SDK path
- Tool locations

---

### Run & UI Automation Commands

#### winapp run

Launch build output as a packaged app without creating an MSIX. With winapp CLI v0.6.0+, project mode can build and run a `.csproj`, solution, or directory containing one.

```bash
winapp run <build-output> [--debug-output] [--symbols] [-- <app-arguments>]
# Or build and run a project directly
winapp run ./MyApp.csproj --configuration Debug --arch x64
```

**VS Code command:** WinDev: Run as Packaged App

With winapp CLI v0.5.0+, `--debug-output` automatically runs WinUI stowed-exception triage after a crash when the app loaded `Microsoft.UI.Xaml.dll`. The report includes the originating HRESULT, ErrorContext chain, native XAML dispatch stack, and managed user frame. Select symbol resolution in the VS Code flow to add `--symbols`; the extension only passes it together with `--debug-output`.

Project mode also supports `--no-build`, `--no-restore`, `--framework`, and repeatable `--property Name=Value` options. For folder mode, use `--output-appx-directory` to choose the loose-layout output location.

---

#### winapp find-ui (v0.6.0+)

Search working WinUI controls and samples from the WinUI 3 Gallery, Windows Community Toolkit, Reactor Gallery, or built-in core patterns.

```bash
winapp find-ui "tabbed layout"
winapp find-ui "color picker" --source toolkit
winapp find-ui --source core --list
```

**VS Code command:** WinDev: Find WinUI Controls & Samples

---

#### Sparse packages and Azure Trusted Signing (v0.6.0+)

`winapp package` accepts a single sparse `appxmanifest.xml` as its input to create an identity-only package for `AllowExternalContent` workflows. The release also fixes generated MSIX bundle versions.

```bash
winapp package ./appxmanifest.xml --output ./SparsePackage.msix
winapp az-sign ./MyApp.msix --metadata-file ./metadata.json
```

**VS Code commands:** WinDev: Create Sparse MSIX Package; WinDev: Sign with Azure Trusted Signing

Azure Trusted Signing requires an authenticated Azure credential. Supply a prepared metadata file, or specify `--subscription`, `--resource-group`, `--account`, and `--profile`.

---

#### winapp ui

Inspect and automate a running Windows app through Microsoft UI Automation.

| Command | Purpose | VS Code command |
|---------|---------|-----------------|
| `ui list-windows` | List visible or hidden app windows | WinDev: UI: List Windows |
| `ui inspect` | Walk an app's UI Automation tree | WinDev: UI: Inspect App |
| `ui screenshot` | Capture an app window | WinDev: UI: Take Screenshot |
| `ui hover` | Trigger hover states, tooltips, and flyouts | WinDev: UI: Hover Element |
| `ui send-keys` | Send text, named keys, or key chords | WinDev: UI: Send Keys |
| `ui click` | Click an element by selector or text | WinDev: UI: Invoke/Click Element |
| `ui set-value` | Set or clear an editable control's value | WinDev: UI: Set Element Value |
| `ui record` | Record an app interaction to H.264 MP4 | WinDev: UI: Record App Interaction |

The four interaction commands exposed in WinDev Helper 4.1 require winapp CLI v0.5.0 or newer. For WinUI controls, choose the `send-input` transport for `ui send-keys`; the default `post-message` transport is intended for classic windowed controls. `--allow-system-keys` is available only with `send-input` and remains opt-in.

```bash
winapp ui send-keys "ctrl+a delete" -a MyApp --via send-input
winapp ui send-keys "Hello world" --target txt-name-a1b2 -a MyApp --via send-input
winapp ui click btn-submit-a1b2 -a MyApp
winapp ui set-value txt-name-a1b2 "Ada Lovelace" -a MyApp
winapp ui record -a MyApp --duration-sec 10 --output demo.mp4
```

---

### Microsoft Store Commands (v0.2.0+)

The `winapp store` subcommand provides integrated Microsoft Store Developer CLI functionality.

#### winapp store reconfigure

Configure Microsoft Store credentials.

```bash
winapp store reconfigure --tenantId <id> --sellerId <id> --clientId <id> --clientSecret <secret>
```

**VS Code command:** WinDev: Configure Microsoft Store Credentials

---

#### winapp store apps list

List all applications in your Store account.

```bash
winapp store apps list
```

**VS Code command:** WinDev: List Microsoft Store Apps

---

#### winapp store publish

Publish an application to the Microsoft Store.

```bash
winapp store publish <project-path> [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--inputFile` | Path to `.msix` or `.msixupload` file |
| `--appId` | Application ID (if not initialized) |
| `--noCommit` | Keep submission in draft state |
| `--flightId` | Publish to a specific flight |
| `--packageRolloutPercentage` | Gradual rollout percentage (1-100) |

**VS Code command:** WinDev: Publish to Microsoft Store

**Example:**

```bash
# Full release
winapp store publish ./my-app

# Gradual rollout
winapp store publish ./my-app --packageRolloutPercentage 10

# Draft only
winapp store publish ./my-app --noCommit
```

---

#### winapp store submission status

Check submission status.

```bash
winapp store submission status <product-id>
```

**VS Code command:** WinDev: Check Store Submission Status

---

### External Catalog Command (v0.2.0+)

#### winapp create-external-catalog

Create an external catalog for asset management.

```bash
winapp create-external-catalog [output-directory]
```

**VS Code command:** WinDev: Create External Catalog

---

## Extension Integration

The WinDev Helper extension integrates with the winapp CLI in several ways:

### Automatic CLI Detection

When you open a WinUI project, the extension:

1. Checks if winapp is in your PATH
2. Falls back to the configured `windevHelper.winAppCliPath` setting
3. Shows a warning if the CLI is not found

### Output Channel

CLI output is displayed in the "WinApp CLI" output channel:

1. View → Output (`Ctrl+Shift+U`)
2. Select "WinApp CLI" from the dropdown

### Progress Indicators

Long-running CLI operations show progress notifications in VS Code.

### Error Handling

If a CLI command fails:

1. An error message is shown
2. Full output is available in the output channel
3. Suggestions for resolution are provided when possible

---

## Common Workflows

### Development Cycle

```bash
# 1. Initialize project
winapp init . --use-defaults

# 2. Create debug identity (optional)
winapp create-debug-identity

# 3. Build and debug using VS Code (F5)

# 4. Package for testing
winapp package -i ./bin/x64/Debug -o ./test/MyApp.msix
```

### UI Automation (v0.5.0+)

```bash
# List windows, including hidden/untitled windows
winapp ui list-windows --show-hidden

# Hover an element to trigger tooltip/flyout behavior
winapp ui hover "btn-minimize-d1a0" -a MyApp --dwell-time 1000

# Send real keyboard input to a WinUI control
winapp ui send-keys "Hello world" --target txt-name-a1b2 -a MyApp --via send-input

# Click and update controls
winapp ui click btn-submit-a1b2 -a MyApp
winapp ui set-value txt-name-a1b2 "Updated value" -a MyApp

# Record a ten-second interaction to MP4
winapp ui record -a MyApp --duration-sec 10 --output ./artifacts/demo.mp4
```

### Release Packaging

```bash
# 1. Build in Release mode
dotnet publish -c Release -r win-x64

# 2. Generate certificate (once)
winapp cert generate -n "CN=MyCompany" -o ./signing/Release.pfx -p SecurePassword

# 3. Create package
winapp package -i ./bin/x64/Release/publish -o ./dist/MyApp.msix

# 4. Sign package
winapp sign -i ./dist/MyApp.msix -c ./signing/Release.pfx -p SecurePassword -t http://timestamp.digicert.com
```

### CI/CD Pipeline

```yaml
# Example Azure DevOps pipeline step
- script: |
    winapp restore
    dotnet build -c Release -p:Platform=x64
    winapp package -i $(Build.BinariesDirectory) -o $(Build.ArtifactStagingDirectory)/MyApp.msix
    winapp sign -i $(Build.ArtifactStagingDirectory)/MyApp.msix -c $(SecureCertPath) -p $(CertPassword)
  displayName: 'Build and Package'
```

---

## Troubleshooting

### CLI Not Found

```
Error: 'winapp' is not recognized as a command
```

**Solutions:**

1. Install the CLI: `winget install Microsoft.WinAppCli`
2. Add to PATH
3. Set `windevHelper.winAppCliPath` in settings

### Certificate Issues

```
Error: Certificate not found or invalid
```

**Solutions:**

1. Verify the certificate path
2. Check the password is correct
3. Ensure the certificate is valid (not expired)
4. Run as Administrator if installing certificates

### Package Creation Fails

```
Error: Failed to create MSIX package
```

**Solutions:**

1. Verify the manifest file exists and is valid
2. Check all required assets are present
3. Ensure the output path is writable
4. Review the output channel for detailed errors

---

## Breaking Changes

### UI Coordinate Terminology (v0.5.0)

The `ui` command family now calls app-relative coordinates **screen coordinates**. Update scripts and documentation that use the old app-coordinate terminology. WinDev Helper's current UI commands target selectors and do not require a code migration.

### Certificate Generation Removed from init (v0.2.0)

`winapp init` no longer generates a certificate automatically. Run `winapp cert generate` explicitly when you need a dev signing certificate. The `--no-cert` flag has been removed since there's nothing to skip.

**Migration:** If your scripts relied on `init` producing a cert, add a `winapp cert generate` step.

### NuGet Global Cache (v0.2.0)

winapp now uses the NuGet global cache for packages instead of `%userprofile%/.winapp/packages`. This avoids duplicate downloads if you already have packages cached.

**Migration:** If your code depends on packages being in the `.winapp` folder, update it to use the NuGet global cache path.

### .NET Projects Skip winapp.yaml (v0.2.0)

When `winapp init` detects a `.csproj`, it configures NuGet packages in the project file directly instead of creating a `winapp.yaml`. This is the correct behavior for .NET projects.

**Migration:** For .NET projects, check the `.csproj` for Windows App SDK package references instead of looking for `winapp.yaml`.

---

## Resources

- [Windows App Development CLI Repository](https://github.com/microsoft/WinAppCli)
- [winapp CLI v0.5.0 Release Notes](https://github.com/microsoft/winappCli/releases/tag/v0.5.0)
- [winapp CLI v0.5.0 Announcement](https://devblogs.microsoft.com/ifdef-windows/windows-app-development-cli-v0-5-0-expanded-ui-automation-js-ts-bindings-and-more/)
- [Announcement Blog Post](https://blogs.windows.com/windowsdeveloper/2026/01/22/announcing-winapp-the-windows-app-development-cli/)
- [MSIX Packaging Documentation](https://learn.microsoft.com/windows/msix/)
- [Code Signing Best Practices](https://learn.microsoft.com/windows/win32/seccrypto/cryptography-tools)
- [Microsoft Store Developer CLI](https://learn.microsoft.com/windows/apps/publish/msstore-dev-cli/commands)
