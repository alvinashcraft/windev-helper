# Windows App Development CLI Guide

This document provides a comprehensive guide to using the Windows App Development CLI (winapp) with the WinDev Helper extension.

## Overview

The Windows App Development CLI (winapp) is a command-line tool that simplifies Windows app development tasks. It provides commands for:

- Project initialization and setup
- Package management
- MSIX packaging and signing
- Certificate generation and management
- App manifest handling
- Debug identity creation

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

---

#### winapp restore

Restore packages and dependencies for the project.

```bash
winapp restore [project-path]
```

**VS Code command:** WinUI: Restore Packages

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

Generate and install development certificates.

```bash
# Generate a new certificate
winapp cert generate -n <subject-name> -o <output-path> -p <password>

# Install a certificate
winapp cert install <certificate-path>
```

**Options for generate:**

| Option | Description |
|--------|-------------|
| `-n, --name` | Certificate subject name (e.g., CN=MyCompany) |
| `-o, --output` | Output path for the .pfx file |
| `-p, --password` | Password for the certificate |

**VS Code commands:**

- WinUI: Generate Development Certificate
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
winapp init

# 2. Create debug identity (optional)
winapp create-debug-identity

# 3. Build and debug using VS Code (F5)

# 4. Package for testing
winapp package -i ./bin/x64/Debug -o ./test/MyApp.msix
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

## Resources

- [Windows App Development CLI Repository](https://github.com/microsoft/WinAppCli)
- [Announcement Blog Post](https://blogs.windows.com/windowsdeveloper/2026/01/22/announcing-winapp-the-windows-app-development-cli/)
- [MSIX Packaging Documentation](https://learn.microsoft.com/windows/msix/)
- [Code Signing Best Practices](https://learn.microsoft.com/windows/win32/seccrypto/cryptography-tools)
