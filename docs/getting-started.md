# Getting Started with WinDev Helper

This guide will walk you through setting up your development environment and creating your first WinUI 3 application using VS Code.

## Prerequisites

Before you begin, ensure you have the following installed:

### 1. .NET 8 SDK

Download and install the .NET 8 SDK from [dotnet.microsoft.com](https://dotnet.microsoft.com/download).

Verify installation:

```bash
dotnet --version
```

### 2. Visual Studio Code

Download VS Code from [code.visualstudio.com](https://code.visualstudio.com).

### 3. Required VS Code Extensions

Install the following extensions:

- **C#** (`ms-dotnettools.csharp`)
- **C# Dev Kit** (`ms-dotnettools.csdevkit`)
- **WinDev Helper** (`windev-helper.windev-helper`)

### 4. Windows App Development CLI

Install the winapp CLI:

```bash
winget install Microsoft.WinAppCli
```

Or download from [github.com/microsoft/WinAppCli](https://github.com/microsoft/WinAppCli).

### 5. WinUI Templates

Install the WinUI project templates:

```bash
dotnet new install VijayAnand.WinUITemplates
```

## Creating Your First WinUI App

### Option 1: Using the Command Palette

1. Open VS Code
2. Press `Ctrl+Shift+P` to open the Command Palette
3. Type "WinUI: Create WinUI Project" and select it
4. Enter your project name (e.g., "HelloWinUI")
5. Choose whether to include MVVM support
6. Select the folder where you want to create the project
7. The project will be created and opened in VS Code

### Option 2: Using the Terminal

```bash
# Create a new directory and navigate to it
mkdir HelloWinUI
cd HelloWinUI

# Create a new WinUI project
dotnet new winui -n HelloWinUI

# Open in VS Code
code .
```

## Understanding the Project Structure

After creating your project, you'll see the following structure:

```
HelloWinUI/
├── Assets/                          # App icons and images
│   ├── LockScreenLogo.scale-200.png
│   ├── SplashScreen.scale-200.png
│   ├── Square150x150Logo.scale-200.png
│   ├── Square44x44Logo.scale-200.png
│   ├── Square44x44Logo.targetsize-24_altform-unplated.png
│   ├── StoreLogo.png
│   └── Wide310x150Logo.scale-200.png
├── Properties/
│   └── launchSettings.json
├── App.xaml                         # Application XAML
├── App.xaml.cs                      # Application code-behind
├── MainWindow.xaml                  # Main window XAML
├── MainWindow.xaml.cs               # Main window code-behind
├── Package.appxmanifest             # App manifest
├── app.manifest                     # Win32 manifest
└── HelloWinUI.csproj                # Project file
```

### Key Files

- **HelloWinUI.csproj**: The project file containing build settings and package references
- **App.xaml/App.xaml.cs**: Application entry point and global resources
- **MainWindow.xaml/MainWindow.xaml.cs**: Your main application window
- **Package.appxmanifest**: App identity, capabilities, and visual assets

## Building the Project

### Using Keyboard Shortcut

Press `Ctrl+Shift+B` to build the project.

### Using the Command Palette

1. Press `Ctrl+Shift+P`
2. Type "WinUI: Build Project" and select it

### Using the Terminal

```bash
dotnet build
```

## Previewing XAML (Preview Feature)

> ⚠️ This is a preview feature available in WinDev Helper 2.x.

The native XAML preview lets you see your UI as you design it, rendered by the actual WinUI 3 engine.

### Opening the Preview

1. Open any `.xaml` file
2. Press `Ctrl+Shift+P`
3. Type "WinUI: Open XAML Preview" and select it
4. The preview panel opens beside your XAML editor

### Using the Preview

- **Click-to-navigate**: Click any element in the preview to jump to its XAML definition
- **Cursor sync**: As you move your cursor in the XAML editor, the preview highlights the corresponding element
- **Theme sync**: The preview automatically matches your VS Code light/dark theme
- **Live updates**: Changes to your XAML are reflected in the preview after a short delay

### Preview Settings

You can customize the preview behavior in Settings (`Ctrl+,`):

- `windevHelper.preview.renderer`: Choose `native` (WinUI 3), `html` (fallback), or `auto` (default)
- `windevHelper.preview.width`: Default preview width (default: 800)
- `windevHelper.preview.height`: Default preview height (default: 600)
- `windevHelper.preview.updateDelay`: Delay before updating preview after edits (default: 300ms)

### Platform Support

| Platform | Renderer | Notes |
|----------|----------|-------|
| Windows | Native (WinUI 3) | Full-fidelity rendering using actual WinUI engine |
| macOS | HTML Fallback | Approximate rendering using HTML/CSS |
| Linux | HTML Fallback | Approximate rendering using HTML/CSS |

The extension automatically selects the best available renderer for your platform. You can override this with the `windevHelper.preview.renderer` setting.

### Known Limitations

- The native renderer requires Windows
- HTML fallback provides approximate styling, not pixel-perfect rendering
- Custom controls from external packages may not render without full project context
- Some complex templates may have limited support

## Running and Debugging

### Start Debugging (F5)

1. Press `F5` to start debugging
2. The project will build and launch with the debugger attached
3. You can set breakpoints, inspect variables, and step through code

### Run Without Debugging (Ctrl+F5)

1. Press `Ctrl+F5` to run without the debugger
2. The app will launch but breakpoints won't be hit

### Using the Command Palette

1. Press `Ctrl+Shift+P`
2. Type "WinUI: Debug Project" or "WinUI: Run Without Debugging"

## Changing Build Configuration

You can switch between Debug and Release configurations:

### Using the Status Bar

1. Click on the "Debug" or "Release" indicator in the status bar
2. Select the desired configuration

### Using the Command Palette

1. Press `Ctrl+Shift+P`
2. Type "WinUI: Select Build Configuration"
3. Choose Debug or Release

## Changing Target Platform

Switch between x86, x64, and ARM64:

### Using the Status Bar

1. Click on the platform indicator (e.g., "x64") in the status bar
2. Select the desired platform

### Using the Command Palette

1. Press `Ctrl+Shift+P`
2. Type "WinUI: Select Target Platform"
3. Choose x86, x64, or ARM64

## Adding New Items

### Adding a New Page

1. Right-click on a folder in the Explorer
2. Select "WinUI: Add New Page"
3. Enter the page name (e.g., "SettingsPage")

Or use the Command Palette:

1. Press `Ctrl+Shift+P`
2. Type "WinUI: Add New Page"

### Adding a New Window

1. Right-click on a folder in the Explorer
2. Select "WinUI: Add New Window"
3. Enter the window name

### Adding a New User Control

1. Right-click on a folder in the Explorer
2. Select "WinUI: Add New User Control"
3. Enter the control name

## Next Steps

Now that you have your first WinUI app running, you can:

1. [Learn about debugging](debugging.md) - Set breakpoints and inspect your app
2. [Create MSIX packages](packaging.md) - Package your app for distribution
3. [Explore templates](templates.md) - Learn about available project and item templates
4. [Configure the extension](configuration.md) - Customize the extension settings

## Troubleshooting

### Common Issues

**Build fails with missing SDK**

Ensure you have the correct .NET SDK version installed:

```bash
dotnet --list-sdks
```

**App won't start**

Try cleaning and rebuilding:

```bash
dotnet clean
dotnet build
```

**Templates not found**

Reinstall the WinUI templates:

```bash
dotnet new uninstall VijayAnand.WinUITemplates
dotnet new install VijayAnand.WinUITemplates
```

### Getting Help

- Check the [VS Code Output panel](debugging.md#output-channels) for error messages
- Review the [Known Issues](../README.md#known-issues) section
- Open an issue on [GitHub](https://github.com/windev-helper/windev-helper/issues)
