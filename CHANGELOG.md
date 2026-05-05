# Changelog

All notable changes to the WinDev Helper extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.10.0] - 2026-05-05

> ⚠️ The preview pane and properties panel features are currently in preview. Please report any bugs or suggestions to our GitHub issues.

This release brings WinDev Helper closer to feature parity with the official [Microsoft WinApp VS Code extension](https://marketplace.visualstudio.com/items?itemName=Microsoft-WinAppCLI.winapp) and adds support for the new official Microsoft Windows App SDK templates.

### Added

- **`winapp` debug type** (parity with the official Microsoft WinApp VS Code extension)
  - New custom debug type that launches the build output via `winapp run` (so the app gets package identity) and then attaches the requested debugger
  - Supports `coreclr` (default, C# / .NET via C# Dev Kit), `cppvsdbg` (C / C++), and `node` (Node.js / Electron) child debuggers
  - Configuration properties: `inputFolder`, `manifest`, `debuggerType`, `workingDirectory`, `args`, `outputAppxDirectory`
  - Auto-detects the build output folder by scanning for `.exe` files (skips `createdump.exe`, `apphost.exe`, and `singlefilehost.exe`)
  - Includes an initial configuration so picking *WinApp* from the F5 picker works without an existing `launch.json`

- **WinDev: Configure WinApp Debug & Tasks**
  - Scaffolds `.vscode/launch.json` and `.vscode/tasks.json` with the recommended `winapp` configuration plus a matching `preLaunchTask` (build) — based on the sample shown in [Chiara Mooney's announcement post](https://devblogs.microsoft.com/ifdef-windows/announcing-the-winapp-vs-code-extension-run-debug-and-package-windows-apps-in-vs-code/)
  - Prompts for project type (.NET, C/C++, Node.js/Electron, or Other) and emits the appropriate build task
  - Merges into existing files without overwriting unrelated entries

- **WinDev: Update Manifest Assets** (winapp CLI v0.2.1+)
  - Wraps `winapp manifest update-assets` to auto-generate all required app icon sizes from a single source image (PNG, JPG, GIF, BMP, or SVG)

- **WinDev: Run SDK Tool**
  - Provides direct access to `makeappx`, `signtool`, `mt`, and `makepri` via `winapp tool`, with custom argument tokenization

- **WinDev: Get WinApp Path**
  - Surfaces the paths reported by `winapp get-winapp-path` in the WinUI Packaging output channel

- **Support for the official Microsoft WinUI templates** ([Microsoft.WindowsAppSDK.WinUI.CSharp.Templates](https://www.nuget.org/packages/Microsoft.WindowsAppSDK.WinUI.CSharp.Templates))
  - The package is currently in alpha. **WinDev: Install WinUI Templates** now lets you choose between the official Microsoft pack and the existing community pack
  - **WinDev: Create WinUI Project** offers the official `winui`, `winui-mvvm`, `winui-navview`, and `winui-unittest` variants when the official pack is selected
  - **WinDev: Create WinUI Library** uses `winui-lib` (official) or `winuilib` (community) automatically
  - New `windevHelper.templates.source` setting (`auto`, `official`, `community`) controls the preference; `auto` prefers the official pack when installed and falls back to the community pack
  - New `windevHelper.templates.allowPrerelease` setting installs the alpha (`*-*`) version of the official pack until a stable release ships

### Changed

- **`winapp run`** now accepts an `outputAppxDirectory` option (mirrors `--output`) so the loose-layout package can be redirected when needed by the new debug type

## [2.9.0] - 2026-05-04

> ⚠️ The preview pane and properties panel features are currently in preview. Please report any bugs or suggestions to our GitHub issues.

### Added

- **Application argument passthrough for `Run as Packaged App`** (winapp CLI v0.3.1)
  - The **WinDev: Run as Packaged App** command now prompts for optional application arguments when the installed CLI is v0.3.1+
  - The input is tokenized (whitespace splits arguments; single/double quotes group values containing spaces; inside double quotes `\"`, `\\`, and `\'` are honored as escape sequences) and then forwarded to the launched app via the new `--` passthrough syntax
  - New `appArgs` option on the `WinAppCli.run()` API for programmatic callers, where each array element is sent as a separate argv entry without further parsing
  - Application passthrough arguments are fully redacted in the WinUI CLI output channel since they may contain secrets such as API keys or connection strings

### Changed

- **Updated for winapp CLI v0.3.1**
  - Inherits the new plain progress streaming when running inside CI or AI-agent terminals (GitHub Actions, Azure DevOps, Copilot CLI, Claude Code, etc.); interactive terminals continue to render the animated spinner tree
  - `winapp ui inspect --interactive` now collapses non-interactive ancestors and surfaces them as `ancestorPath` on surviving descendants, with `+more` markers for truncated subtrees

### Fixed

- **winapp CLI bug fixes inherited from v0.3.1**
  - `winapp run` no longer accidentally selects `createdump.exe` when multiple `.exe` files exist alongside the app
  - `winapp register` now reports package-already-exists conflicts (HRESULT `0x80073CFB`) with an actionable hint instead of a misleading Developer Mode error
  - `winapp unregister` is safer for per-package removals: fixed a containment check that could misclassify sibling directories and a safety check that could be bypassed when multiple packages were classified together
  - Failed operations now surface real exception messages instead of `(null)` in status output
  - NuGet version range parsing on cache-warm runs no longer breaks when brackets are pre-stripped
  - Forward compatibility with WinAppSDK 2.0.1's new major-only framework package naming (`Microsoft.WindowsAppRuntime.2`)

## [2.8.0] - 2026-04-22

> ⚠️ The preview pane and properties panel features are currently in preview. Please report any bugs or suggestions to our GitHub issues.

### Added

- **Run as Packaged App** (winapp CLI v0.3.0)
  - New **WinDev: Run as Packaged App** command to launch apps as packaged apps from a build output folder
  - Supports detached mode, debug output with crash dumps, and automatic unregister on exit
  - Equivalent to Visual Studio's F5 experience for packaged apps

- **Unregister Dev Package** (winapp CLI v0.3.0)
  - New **WinDev: Unregister Dev Package** command to clean up sideloaded dev packages

- **UI Automation** (winapp CLI v0.3.0)
  - New **WinDev: UI: List Windows** command to enumerate visible app windows
  - New **WinDev: UI: Inspect App** command to walk the UI Automation tree of a running app
  - New **WinDev: UI: Take Screenshot** command to capture app window screenshots
  - Enables agentic and automated testing workflows

- **Add App Execution Alias** (winapp CLI v0.3.0)
  - New **WinDev: Add App Execution Alias** command to add `uap5:AppExecutionAlias` to manifests
  - Allows launching packaged apps by name from the command line

### Changed

- **Updated for winapp CLI v0.3.0**
  - `winapp init` and `winapp manifest generate` now create `Package.appxmanifest` (VS convention) instead of `appxmanifest.xml`
  - .NET projects initialized with `winapp init` now include `Microsoft.Windows.SDK.BuildTools.WinApp` NuGet package for `dotnet run` support
  - `get-winapp-path` gracefully falls back to global cache when local cache is missing

## [2.7.0] - 2026-03-31

> ⚠️ The preview pane and properties panel features are currently in preview. Please report any bugs or suggestions to our GitHub issues.

### Added

- **Certificate Info Command** (winapp CLI v0.2.1)
  - New **WinDev: View Certificate Info** command to inspect PFX certificate details (subject, issuer, validity)
  - Displays certificate information in the WinUI Packaging output channel

- **Export Public Key as .cer** (winapp CLI v0.2.1)
  - Generate Development Certificate now offers to export the public key as a `.cer` file via the `--export-cer` flag

- **Expanded XAML Preview Control Support** (Phase 1 & 2)
  - Added HTML fallback renderers for 15 additional WinUI controls, bringing total to 69
  - **Phase 1 (high-value):** TreeView, TreeViewItem, ContentDialog, AutoSuggestBox, NumberBox, GridView, RichTextBlock, BreadcrumbBar
  - **Phase 2 (commonly used):** TeachingTip, DropDownButton, SplitButton, ToggleSplitButton, RatingControl, ColorPicker, PersonPicture, RichEditBox
  - Native renderer on Windows already supports all WinUI controls natively

### Improved

- **SVG Support for Asset Generation** (winapp CLI v0.2.1)
  - `manifest update-assets` now accepts SVG files, converting them to bitmap images for all required sizes

- **Automatic WinRT Component Discovery** (winapp CLI v0.2.1)
  - Packaging automatically discovers and registers third-party WinRT components from `.winmd` files

- **Packaging Bug Fixes** (winapp CLI v0.2.1)
  - Prevents overwriting existing PRI resources during packaging
  - Checks executable architecture before packaging
  - Warns when `.pfx` files are found in the input folder

## [2.6.0] - 2026-02-28 (Preview)

> ⚠️ This is a preview release. To use stable releases only, disable pre-release versions in VS Code.

### Added

- **Microsoft Store Integration** (via winapp CLI v0.2.0)
  - New **WinDev: Configure Microsoft Store Credentials** command to set up Partner Center authentication
  - New **WinDev: List Microsoft Store Apps** command to view apps in your Store account
  - New **WinDev: Publish to Microsoft Store** command with support for:
    - Full release (100% rollout)
    - Gradual rollout with configurable percentage
    - Draft submissions (publish without committing)
  - New **WinDev: Check Store Submission Status** command to monitor submission progress
  - Wraps the Microsoft Store Developer CLI (`msstore`) through the `winapp store` subcommand

- **External Catalog Support** (winapp CLI v0.2.0)
  - New **WinDev: Create External Catalog** command for streamlined asset management

- **Manifest Enhancements** (winapp CLI v0.2.0)
  - Support for qualified names in AppxManifest files
  - Support for manifest placeholders for dynamic content

### Changed

- **Updated for winapp CLI v0.2.0 Breaking Changes**
  - `winapp init` no longer generates certificates automatically
  - Initialize Project command now prompts to generate a certificate after initialization
  - .NET projects configure NuGet packages directly in `.csproj` instead of `winapp.yaml`
  - Project initialization detection updated to check both `winapp.yaml` AND `.csproj` files
  - winapp CLI now uses NuGet global cache for packages (improved efficiency)

### Improved

- **Better .NET Project Support**
  - Extension correctly detects initialized .NET projects that don't have `winapp.yaml`
  - Restore Packages command works seamlessly with both .NET and non-.NET workflows
  - Updated error messages to reflect new .NET project behavior

## [2.5.0] - 2026-02-07 (Preview)

> ⚠️ This is a preview release. To use stable releases only, disable pre-release versions in VS Code.

### Added

- **XAML Properties Pane** (Preview Feature)
  - New "Properties" panel in the XAML view container
  - Displays all properties for the selected XAML element
  - Full metadata database for ~65 WinUI 3 control types with inheritance
  - ~35 attached property definitions (Grid, Canvas, ScrollViewer, etc.)
  - Properties grouped by category (Layout, Appearance, Common, Content, Interaction, Text, Brushes, Accessibility)
  - Toggle between set properties only and all available properties (including defaults)
  - Toggle between grouped and flat property views
  - Copy property values and navigate to XAML definitions
  - Visual indicators for data-bound properties

- **MSIX Packaged App Support**
  - Deploy MSIX packages for development using `Add-AppxPackage -Register`
  - Launch packaged apps through their package identity (`shell:AppsFolder`)
  - Automatic AppxManifest.xml discovery in build output
  - Packaged app detection via `WindowsPackageType` in .csproj
  - Run Without Debugging support for both packaged and unpackaged apps

### Improved

- **XAML Preview Robustness**
  - New XAML preprocessor that sanitizes third-party/unknown namespace elements
  - Graceful handling of CommunityToolkit and other NuGet control libraries
  - `<Window>` root elements automatically converted for preview rendering
  - Unknown namespace elements replaced with `<Grid>` placeholders
  - Attribute whitelist ensures only FrameworkElement-compatible attributes are kept
  - Resource entries from unknown namespaces are stripped to prevent parse errors
  - Preview warnings displayed for replaced or removed elements

- **XAML Preview Performance**
  - Native renderer pre-initialized during renderer selection (no first-render timeout)
  - Warm-up ping sent after pipe connection to verify renderer readiness

- **Debugging**
  - Improved executable path resolution for both packaged and unpackaged apps
  - Multi-path fallback: checks RID subfolder, TFM folder, and AppX layout
  - Informational message when debugging packaged apps (suggests unpackaged for full debug support)

- **Project Creation**
  - Fixed project folder detection when `dotnet new` creates a subfolder

### Known Limitations

- Debugger attachment is not yet supported for MSIX-packaged apps; they launch without a debugger. Set `WindowsPackageType` to `None` in your .csproj for full debugging support.
- XAML preview may not render third-party controls; they appear as placeholder grids
- Property pane metadata covers ~65 common WinUI controls; uncommon controls may have limited property defaults

## [2.0.0] - 2026-01-31 (Preview)

> ⚠️ This is a preview release. To use stable releases only, disable pre-release versions in VS Code.

### Added

- **Native XAML Preview** (Preview Feature)
  - Real-time XAML preview using the actual WinUI 3 rendering engine
  - True-to-production rendering accuracy
  - Click any element in the preview to navigate to its XAML definition
  - Bidirectional sync between editor cursor and preview selection
  - Light and dark theme support (respects VS Code theme)
  - Project resource loading (App.xaml and merged resource dictionaries)
  - Data binding visualization with placeholder values
  - Custom resource fallback handling

- **HTML Fallback Preview** (macOS/Linux)
  - Cross-platform XAML preview using HTML/CSS approximation
  - Same click-to-navigate and cursor sync features
  - Automatic platform detection - no configuration required
  - Approximate WinUI control styling

- **New Extension Settings**
  - `windevHelper.preview.renderer` - Choose between native, HTML, or auto
  - `windevHelper.preview.width` - Default preview width
  - `windevHelper.preview.height` - Default preview height
  - `windevHelper.preview.updateDelay` - Debounce delay for preview updates

- **New Commands**
  - `WinUI: Open XAML Preview` - Open the native XAML preview panel

### Technical

- Bundled native renderer (XamlPreviewHost) for WinUI 3 rendering
- Named pipe IPC between VS Code and native renderer process
- DPI-aware overlay positioning for element selection
- XAML preprocessing to handle design-time attributes

### Known Limitations

- Native renderer requires Windows (uses WinUI 3)
- HTML fallback provides approximate styling, not pixel-perfect rendering
- Some custom controls may not render without full project context
- Complex DataTemplates may have limited preview support
- Element matching may be imprecise for dynamically generated content

## [1.0.0] - 2026-01-23

### Added

- **Project Management**
  - Automatic WinUI project detection in workspace
  - Support for C#/.NET WinUI 3 projects
  - Integration with C# Dev Kit extension

- **Build & Configuration**
  - Build, rebuild, and clean commands
  - Debug/Release configuration switching
  - x86, x64, and ARM64 platform support
  - Status bar indicators for current configuration and platform

- **Debugging**
  - F5 to debug WinUI applications
  - Custom debug configuration provider
  - Integration with .NET debugger (coreclr)
  - Run without debugging support

- **Templates**
  - Create new WinUI 3 projects (with optional MVVM support)
  - Create WinUI class libraries
  - Add new Pages, Windows, and User Controls
  - Integration with WinUI Templates package

- **Packaging**
  - MSIX package creation
  - Package signing with certificates
  - Development certificate generation
  - Certificate installation

- **App Identity**
  - Debug identity creation
  - App manifest generation
  - Manifest file management

- **Windows App Development CLI Integration**
  - Full integration with winapp CLI
  - Setup commands (init, restore, update)
  - Packaging commands (package, sign)
  - Certificate commands (cert generate, cert install)

- **Extension Dependencies**
  - Requires C# extension
  - Requires C# Dev Kit extension

### Documentation

- Comprehensive README with features and usage
- Getting Started guide
- Commands reference
- Configuration guide
- Windows App Development CLI guide
- Templates guide
- Debugging guide
- Packaging guide
- Contributing guidelines
- Architecture documentation

## [Unreleased]

### Planned

- XAML syntax highlighting and IntelliSense
- XAML Hot Reload support
- C++ WinUI project support
- Additional project templates