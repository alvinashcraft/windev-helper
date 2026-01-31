# Changelog

All notable changes to the WinDev Helper extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- **New Extension Settings**
  - `windevHelper.preview.renderer` - Choose between native or HTML renderer
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

- Requires Windows (native renderer uses WinUI 3)
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