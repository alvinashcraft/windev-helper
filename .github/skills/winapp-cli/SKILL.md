---
name: winapp-cli
description: 'Windows App Development CLI (winapp) for building, packaging, and deploying Windows applications. Use when asked to initialize Windows app projects, create MSIX packages, generate AppxManifest.xml, manage development certificates, add package identity for debugging, sign packages, publish to Microsoft Store, or access Windows SDK build tools. Supports .NET, C++, Electron, Rust, Tauri, and cross-platform frameworks targeting Windows.'
license: MIT
version: '0.2.0'
---

# Windows App Development CLI (winapp)

The Windows App Development CLI (`winapp`) is a command-line interface for managing Windows SDKs, MSIX packaging, generating app identity, manifests, certificates, and using build tools with any app framework. It bridges the gap between cross-platform development and Windows-native capabilities.

## When to Use This Skill

Use this skill when you need to:

- Initialize a Windows app project with SDK setup, manifests, and certificates
- Create MSIX packages from application directories
- Generate or manage AppxManifest.xml files
- Create and install development certificates for signing
- Add package identity for debugging Windows APIs
- Sign MSIX packages or executables
- Access Windows SDK build tools from any framework
- Build Windows apps using cross-platform frameworks (Electron, Rust, Tauri, Qt)
- Set up CI/CD pipelines for Windows app deployment
- Access Windows APIs that require package identity (notifications, Windows AI, shell integration)
- Publish applications to the Microsoft Store (via `winapp store` subcommand)
- Create external catalogs for asset management

## Prerequisites

- Windows 10 or later
- winapp CLI installed via one of these methods:
  - **WinGet**: `winget install Microsoft.WinAppCli --source winget`
  - **NPM** (for Electron): `npm install @microsoft/winappcli --save-dev`
  - **GitHub Actions/Azure DevOps**: Use [setup-WinAppCli](https://github.com/microsoft/setup-WinAppCli) action
  - **Manual**: Download from [GitHub Releases](https://github.com/microsoft/WinAppCli/releases/latest)

## Core Commands Reference

### init - Initialize Project Workspace

Initializes a directory with required assets (manifest, certificates, libraries) for building a modern Windows app.

```bash
winapp init [<base-directory>] [options]
```

**Key Options:**

| Option | Description |
| ------ | ----------- |
| `--setup-sdks <mode>` | SDK installation: `stable` (default), `preview`, `experimental`, `none` |
| `--config-dir <dir>` | Directory to read/store configuration |
| `--no-prompt` | Use defaults without prompting |
| `--config-only` | Only create/validate configuration file |
| `--no-gitignore` | Don't update .gitignore file |

> **v0.2.0 Breaking Change:** `init` no longer generates a certificate automatically. Run `winapp cert generate` explicitly when you need a dev signing certificate. The `--no-cert` flag has been removed.
>
> **v0.2.0 .NET Projects:** When `winapp init` detects a `.csproj`, it configures NuGet packages in the project file directly instead of creating a `winapp.yaml`. This is the expected behavior for .NET projects.

**Example:**

```bash
# Initialize with defaults
winapp init

# Initialize with preview SDKs
winapp init --setup-sdks preview

# Initialize without prompts (CI/CD)
winapp init --no-prompt
```

### restore - Restore Workspace Packages

Restore packages from `winapp.yaml` (or `.csproj` for .NET projects) and ensure workspace is ready.

```bash
winapp restore [<base-directory>] [options]
```

**Options:**

| Option | Description |
| ------ | ----------- |
| `--config-dir <dir>` | Directory to read configuration from |
| `-v, --verbose` | Enable verbose output |
| `-q, --quiet` | Suppress progress messages |

> **v0.2.0 Note:** winapp now uses the NuGet global cache for packages instead of `%userprofile%/.winapp/packages`. This avoids duplicate downloads if you already have packages cached.

**Example:**

```bash
# Restore packages in current directory
winapp restore

# Restore with verbose output
winapp restore --verbose
```

### pack (package) - Create MSIX Package

Create an MSIX package from a prepared package directory.

```bash
winapp pack <input-folder> [options]
```

**Key Options:**

| Option | Description |
| ------ | ----------- |
| `--output <file>` | Output MSIX filename (defaults to `<name>.msix`) |
| `--name <name>` | Package name (default: from manifest) |
| `--cert <path>` | Path to signing certificate (auto-signs if provided) |
| `--cert-password <pwd>` | Certificate password (default: `password`) |
| `--generate-cert` | Generate a new development certificate |
| `--install-cert` | Install certificate to machine |
| `--manifest <path>` | Path to AppxManifest.xml |
| `--self-contained` | Bundle Windows App SDK runtime |
| `--skip-pri` | Skip PRI file generation |

**Examples:**

```bash
# Basic packaging
winapp pack ./build-output

# Package with signing
winapp pack ./my-app --cert ./devcert.pfx --cert-password MyPassword

# Generate cert and package
winapp pack ./my-app --generate-cert --output MyApp.msix

# Self-contained deployment
winapp pack ./my-app --self-contained
```

### manifest - AppxManifest.xml Management

Generate and manage AppxManifest.xml files.

#### Generate Manifest

```bash
winapp manifest generate <directory>
```

**Example:**

```bash
# Generate manifest in project directory
winapp manifest generate ./my-app
```

#### Update Image Assets

```bash
winapp manifest update-assets <image-path>
```

Updates image assets in AppxManifest.xml from a source image, generating all required sizes and aspect ratios.

**Example:**

```bash
# Update all app assets from logo
winapp manifest update-assets ./images/my-logo.png
```

### create-debug-identity - Add Package Identity for Debugging

Create and install a temporary package for debugging. Required for testing APIs that need package identity without full packaging.

```bash
winapp create-debug-identity [<entrypoint>] [options]
```

**Options:**

| Option | Description |
| ------ | ----------- |
| `--manifest <path>` | Path to the appxmanifest.xml |
| `--no-install` | Do not install the package after creation |
| `-v, --verbose` | Enable verbose output |

**Example:**

```bash
# Add identity to executable
winapp create-debug-identity ./bin/MyApp.exe

# With custom manifest
winapp create-debug-identity ./bin/MyApp.exe --manifest ./AppxManifest.xml
```

**Note:** Must be called every time the appxmanifest.xml is modified for changes to take effect.

### cert - Certificate Management

Generate or install development certificates.

#### Generate Certificate

```bash
winapp cert generate
```

**Example:**

```bash
# Generate new development certificate
winapp cert generate
```

#### Install Certificate

```bash
winapp cert install <cert-path>
```

**Example:**

```bash
# Install certificate to local machine store
winapp cert install ./devcert.pfx
```

### sign - Sign Packages

Sign a file or package with a certificate.

```bash
winapp sign <file-path> <cert-path> [options]
```

**Options:**

| Option | Description |
| ------ | ----------- |
| `--password <pwd>` | Certificate password (default: `password`) |
| `--timestamp <url>` | Timestamp server URL |
| `-v, --verbose` | Enable verbose output |

**Example:**

```bash
# Sign MSIX package
winapp sign ./MyApp.msix ./devcert.pfx --password MyPassword

# Sign with timestamp
winapp sign ./MyApp.msix ./cert.pfx --timestamp http://timestamp.digicert.com
```

### update - Update Packages and Tools

Update packages in `winapp.yaml` and install/update build tools in cache.

```bash
winapp update [options]
```

**Options:**

| Option | Description |
| ------ | ----------- |
| `--setup-sdks <mode>` | SDK installation mode: `stable`, `preview`, `experimental`, `none` |
| `-v, --verbose` | Enable verbose output |

**Example:**

```bash
# Update to latest stable
winapp update

# Update to preview SDKs
winapp update --setup-sdks preview
```

### run-buildtool (tool) - Access SDK Build Tools

Run a build tool command with Windows SDK paths configured.

```bash
winapp tool [options] [[--] <additional arguments>...]
```

**Example:**

```bash
# Run a build tool with SDK paths
winapp tool -- makeappx pack /d ./app /p ./app.msix
```

### get-winapp-path - Get SDK Paths

Get the path to the `.winapp` directory.

```bash
winapp get-winapp-path [--global]
```

**Example:**

```bash
# Get local .winapp path
winapp get-winapp-path

# Get global .winapp path
winapp get-winapp-path --global
```

### store - Microsoft Store Integration (v0.2.0+)

Run Microsoft Store Developer CLI commands directly from winapp. This wraps the `msstore` CLI, enabling integrated Store development workflows.

```bash
winapp store <subcommand> [options]
```

**Available Subcommands:**

| Subcommand | Description |
| ---------- | ----------- |
| `reconfigure` | Configure Store credentials (tenantId, sellerId, clientId, clientSecret) |
| `apps list` | List all applications in your Store account |
| `apps get <productId>` | Get details of a specific application |
| `submission status <productId>` | Get submission status |
| `submission publish <productId>` | Publish a submission |
| `publish <path>` | Package and publish application to Store |
| `package <path>` | Package application for Store submission |
| `init <path>` | Initialize project for Store publishing |

**Examples:**

```bash
# Configure Store credentials
winapp store reconfigure --tenantId xxx --sellerId xxx --clientId xxx --clientSecret xxx

# List Store apps
winapp store apps list

# Publish to Store
winapp store publish ./my-app

# Package for Store
winapp store package ./my-app --output ./packages --arch x64,arm64
```

**Publishing Options:**

| Option | Description |
| ------ | ----------- |
| `-i, --inputFile` | Path to `.msix` or `.msixupload` file |
| `-id, --appId` | Application ID (if not initialized) |
| `-nc, --noCommit` | Keep submission in draft state |
| `-f, --flightId` | Publish to a specific flight |
| `-prp, --packageRolloutPercentage` | Gradual rollout percentage (1-100) |

### create-external-catalog - Asset Management (v0.2.0+)

Create an external catalog for streamlined asset management across applications.

```bash
winapp create-external-catalog [<output-directory>] [options]
```

**Example:**

```bash
# Create external catalog in current directory
winapp create-external-catalog

# Create in specific directory
winapp create-external-catalog ./catalogs
```

## Common Workflows

### Workflow 1: Initialize New Windows App Project

```bash
# 1. Navigate to project root
cd my-project

# 2. Initialize workspace (creates manifest, assets, SDK setup)
winapp init

# 3. Generate a development certificate for signing (v0.2.0+: no longer automatic)
winapp cert generate

# 4. Your project now has:
#    - AppxManifest.xml (or configured .csproj for .NET projects)
#    - Windows SDK configuration
#    - winapp.yaml configuration (non-.NET projects only)
#    - Development certificate (after running cert generate)
```

### Workflow 2: Debug with Package Identity

For testing Windows APIs that require package identity (notifications, Windows AI, shell integration):

```bash
# 1. Initialize project if not done
winapp init

# 2. Build your application
# (your build command here)

# 3. Add debug identity to your executable
winapp create-debug-identity ./bin/MyApp.exe

# 4. Run your app - it now has package identity for debugging
./bin/MyApp.exe
```

### Workflow 3: Package for Distribution

```bash
# 1. Build your application
# (your build command here)

# 2. Create MSIX package with signing
winapp pack ./build-output --generate-cert --output MyApp.msix

# Or with existing certificate
winapp pack ./build-output --cert ./mycert.pfx --cert-password secret
```

### Workflow 4: CI/CD Pipeline Setup

```yaml
# GitHub Actions example
- name: Setup winapp CLI
  uses: microsoft/setup-WinAppCli@v1

- name: Initialize and Package
  run: |
    winapp init --no-prompt
    winapp cert generate  # v0.2.0+: explicit cert generation
    winapp pack ./build-output --output MyApp.msix
```

### Workflow 5: Electron App Integration

```bash
# 1. Install via npm
npm install @microsoft/winappcli --save-dev

# 2. Initialize project
npx winapp init

# 3. Add debug identity for Electron
npx winapp node add-electron-debug-identity

# 4. Create native addon (C++ or C#)
npx winapp node create-addon

# 5. Package for distribution
npx winapp pack ./out --output MyElectronApp.msix
```

### Workflow 6: Publish to Microsoft Store (v0.2.0+)

```bash
# 1. Configure Store credentials (one-time setup)
winapp store reconfigure --tenantId $TENANT_ID --sellerId $SELLER_ID --clientId $CLIENT_ID --clientSecret $CLIENT_SECRET

# 2. Initialize project for Store (sets up app identity)
winapp store init ./my-app

# 3. Package for Store submission
winapp store package ./my-app --arch x64,arm64

# 4. Publish to Store
winapp store publish ./my-app

# Or publish with gradual rollout
winapp store publish ./my-app --packageRolloutPercentage 10

# Or publish as draft (no commit)
winapp store publish ./my-app --noCommit
```

## Windows APIs Enabled by Package Identity

Package identity unlocks access to powerful Windows APIs:

| API Category | Examples |
| ------------ | -------- |
| **Notifications** | Interactive native notifications, notification management |
| **Windows AI** | On-device LLM, text/image AI APIs (Phi Silica, Windows ML) |
| **Shell Integration** | Explorer, Taskbar, Share sheet integration |
| **Protocol Handlers** | Custom URI schemes (`yourapp://`) |
| **Web-to-App Linking** | Direct website-to-app navigation |
| **Device Access** | Camera, microphone, location (with consent) |
| **Background Tasks** | Run when app is closed |
| **File Associations** | Open file types with your app |
| **Startup Tasks** | Launch at Windows login |
| **App Services** | Expose APIs to other apps |

## Troubleshooting

| Issue | Solution |
| ----- | -------- |
| Certificate not trusted | Run `winapp cert install <cert-path>` to install to local machine store |
| Package identity not working | Run `winapp create-debug-identity` after any manifest changes |
| SDK not found | Run `winapp restore` or `winapp update` to ensure SDKs are installed |
| Signing fails | Verify certificate password and ensure cert is not expired |
| Assets not generated | Run `winapp manifest update-assets <image-path>` with a valid image |
| No certificate after init (v0.2.0+) | Run `winapp cert generate` explicitly - init no longer auto-generates certs |
| Missing winapp.yaml for .NET (v0.2.0+) | This is expected - .NET projects configure packages in .csproj directly |
| Store publish fails | Run `winapp store reconfigure` to verify credentials are set |

## Framework-Specific Guides

| Framework | Guide |
| --------- | ----- |
| .NET | [Get Started with .NET](https://github.com/microsoft/WinAppCli/blob/main/docs/guides/dotnet.md) |
| C++/CMake | [Get Started with C++](https://github.com/microsoft/WinAppCli/blob/main/docs/guides/cpp.md) |
| Electron | [Get Started with Electron](https://github.com/microsoft/WinAppCli/blob/main/docs/electron-get-started.md) |
| Rust | [Get Started with Rust](https://github.com/microsoft/WinAppCli/blob/main/docs/guides/rust.md) |
| Tauri | [Get Started with Tauri](https://github.com/microsoft/WinAppCli/blob/main/docs/guides/tauri.md) |

## References

- [GitHub Repository](https://github.com/microsoft/WinAppCli)
- [Full CLI Documentation](https://github.com/microsoft/WinAppCli/blob/main/docs/usage.md)
- [Sample Applications](https://github.com/microsoft/WinAppCli/tree/main/samples)
- [Windows App SDK](https://learn.microsoft.com/windows/apps/windows-app-sdk/)
- [MSIX Packaging Overview](https://learn.microsoft.com/windows/msix/overview)
- [Microsoft Store Developer CLI](https://learn.microsoft.com/windows/apps/publish/msstore-dev-cli/commands)
- [Package Identity Overview](https://learn.microsoft.com/windows/apps/desktop/modernize/package-identity-overview)
