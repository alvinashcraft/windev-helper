# Changelog

All notable changes to the WinDev Helper extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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