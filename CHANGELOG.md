# Changelog

All notable changes to the WinDev Helper extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.0] - 2026-06-04

Aligns the extension with [winapp CLI v0.3.2](https://github.com/microsoft/winappCli/releases/tag/v0.3.2).

### Added

- **MSIX bundle packaging** - **WinDev: Create MSIX Package** now produces an `.msixbundle` when you choose a bundle output file. It prompts for one build-output folder per architecture (e.g. `x64` and `arm64`) and passes them all to `winapp package`, which creates a bundle from multiple input folders
- **Screenshot window focus** - **WinDev: UI: Take Screenshot** can bring the target window to the foreground before capturing, using the new `winapp ui screenshot --focus` flag. The option is offered automatically when winapp CLI v0.3.2 or newer is detected

### Changed

- **More resilient `winapp --version` parsing** - Version detection now skips the daily "update available" banner introduced in winapp CLI v0.3.2 so the installed version is still read correctly

## [3.1.0] - 2026-05-20

This release modernizes the WinUI agent plugin setup to use the new [microsoft/win-dev-skills](https://github.com/microsoft/win-dev-skills) marketplace, adds a Windows development environment checker, and introduces light-touch support for the experimental [Microsoft.UI.Reactor](https://microsoft.github.io/microsoft-ui-reactor/) declarative C# UI framework.

### Added

- **WinDev: Check Windows Dev Environment** - Runs a diagnostic check of the local toolchain (.NET SDK ≥ 8, WinApp CLI ≥ 0.3, WinUI templates, and Developer Mode) and reports results with fix commands in a dedicated output channel
- **WinDev: Open WinUI Agent Skills Repository** - Opens the [microsoft/win-dev-skills](https://github.com/microsoft/win-dev-skills) repository in the browser
- **WinDev: Create Reactor App** - Scaffolds a new [Microsoft.UI.Reactor](https://github.com/microsoft/microsoft-ui-reactor) app via the `dotnet new reactorapp` template
- **WinDev: Reactor: Run Bootstrap** - Builds the Reactor framework, the `mur` CLI tool, and registers the `dotnet new reactorapp` template from a local clone via `bootstrap.ps1`
- **WinDev: Reactor: Open Documentation** - Opens the [Microsoft.UI.Reactor documentation](https://microsoft.github.io/microsoft-ui-reactor/)
- **WinDev: Reactor: Install Agent Plugin** - Installs the Reactor agent plugin for the GitHub Copilot CLI
- **Reactor project detection** - Projects referencing `Microsoft.UI.Reactor` are now detected and surfaced via the `windevHelper.isReactorProject` context key
- **`windevHelper.reactor.repoPath` setting** - Points the Reactor bootstrap command at a local clone of `microsoft/microsoft-ui-reactor`
- **Smart project-folder detection for item templates** - Add-item commands now locate the project directory automatically (searching the invocation path, immediate subfolders, then walking up the tree, and prompting to pick when multiple `.csproj` files are found) instead of assuming the workspace root, and offer a target-folder picker with **Current Folder**, **Project Folder**, and a category default (Views, Views/Controls, or Resources) - contributed by [@mcNets](https://github.com/mcNets)

### Changed

- **WinDev: Install WinUI Copilot Plugin** is now **WinDev: Install WinUI Agent + Skills Plugin** - Updated to use the new `microsoft/win-dev-skills` marketplace flow (`copilot plugin marketplace add microsoft/win-dev-skills` + `copilot plugin install winui@win-dev-skills`) instead of the previous `awesome-copilot` source

## [3.0.0] - 2026-05-13

WinDev Helper returns to **production-ready** status with this release. The `preview` flag was originally set on the 2.x line while the experimental Native XAML Preview pane and XAML Properties Pane features were under active development; both have stabilized enough to drop the release-wide preview label. The `preview` flag has been removed from the extension manifest and preview-release callouts have been retired across the docs. The Native XAML Preview pane and XAML Properties Pane remain individually labeled as preview while they continue to mature.

This release also picks up the [new official `dotnet new` templates for WinUI](https://devblogs.microsoft.com/ifdef-windows/introducing-dotnet-new-templates-for-winui/) (PR [microsoft/WindowsAppSDK#6407](https://github.com/microsoft/WindowsAppSDK/pull/6407)) and adds a one-click setup helper for the new [WinUI agent plugin](https://devblogs.microsoft.com/ifdef-windows/build-native-windows-apps-with-ai-agents-for-winui-and-windows-app-sdk/) for the GitHub Copilot CLI and Claude Code.

### Added

- **TabView project template** - The `winui-tabview` template from the official Microsoft pack is now offered alongside Blank, NavigationView, MVVM, and Unit Test variants in **WinDev: Create WinUI Project**
- **WinDev: Add New Content Dialog** - Scaffolds a `ContentDialog` via the official `winui-dialog` item template
- **WinDev: Add New Templated Control** - Scaffolds a custom (templated) control with its `Themes/Generic.xaml` entry via the official `winui-templatedcontrol` item template
- **WinDev: Add New Resource Dictionary** - Scaffolds a `ResourceDictionary` XAML file via the official `winui-resourcedictionary` item template
- **WinDev: Install WinUI Copilot Plugin** - Helper that opens the GitHub Copilot CLI in a new terminal and copies the `/plugin install winui@awesome-copilot` slash-command to the clipboard so it can be pasted at the prompt. Also offers Copy Commands and Open Docs options
- New explorer and Solution Explorer context-menu entries for the dialog, templated control, and resource dictionary item templates

### Changed

- **Removed `preview: true` flag from `package.json`** - The extension is no longer marked as a preview release on the Marketplace
- **Removed preview-release banner** from the main README and from the documentation index
- **Updated template-package descriptions** to drop "currently in alpha" references now that the official Microsoft pack has stabilized
- **README/docs guidance** now recommends `dotnet new install Microsoft.WindowsAppSDK.WinUI.CSharp.Templates` (no `::*-*` prerelease suffix required) and showcases the new `winui-navview` / `winui-tabview` / `winui-mvvm` short names
- All scaffolded projects now reference `Microsoft.Windows.SDK.BuildTools.WinApp` so `dotnet run` Just Works for packaged apps without manual `Add-AppxPackage` steps - documented in the README

## [2.10.0] - 2026-05-05

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
- **C# Dev Kit is now an optional / recommended dependency** ([#7](https://github.com/alvinashcraft/windev-helper/issues/7))
  - Removed `ms-dotnettools.csdevkit` from `extensionDependencies` so users who cannot use C# Dev Kit under [its proprietary license](https://aka.ms/vs/csdevkit/license) are no longer forced to install it
  - The open-source `ms-dotnettools.csharp` extension remains required
  - All build, debug, packaging, manifest, certificate, and template features continue to work without C# Dev Kit. The only feature gated by C# Dev Kit is the Solution Explorer context-menu shortcut for `Add New Page` / `User Control` / `Window` / `ViewModel` — those commands remain available from the Command Palette and the file Explorer context menu
- **Open VSX Registry support**
  - Added `ovsx` as a devDependency and new `publish:openvsx` / `publish:openvsx:prerelease` npm scripts so the extension can be published to [Open VSX](https://open-vsx.org/) alongside the Visual Studio Marketplace
  - Removing the C# Dev Kit hard dependency unblocks publishing to Open VSX, which means the extension can now be installed in editors such as [VSCodium](https://vscodium.com/), [Cursor](https://cursor.com/), and [Windsurf](https://codeium.com/windsurf) that use the Open VSX Registry instead of the Microsoft marketplace

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