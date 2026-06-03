# WinUI Templates Guide

This document covers the project and item templates available through the WinDev Helper extension.

## Overview

The extension supports two `dotnet new` template packages:

- **Official:** [`Microsoft.WindowsAppSDK.WinUI.CSharp.Templates`](https://www.nuget.org/packages/Microsoft.WindowsAppSDK.WinUI.CSharp.Templates) - the official Microsoft pack introduced in [WindowsAppSDK#6407](https://github.com/microsoft/WindowsAppSDK/pull/6407). Ships Blank, NavigationView, TabView, MVVM, Library, and Unit Test project templates plus item templates for pages, windows, user controls, content dialogs, templated controls, and resource dictionaries. Projects reference `Microsoft.Windows.SDK.BuildTools.WinApp` so `dotnet run` Just Works for packaged apps.
- **Community:** [`VijayAnand.WinUITemplates`](https://github.com/egvijayanand/winui-templates) - the long-standing community pack (uses a single `winui` template with a `-mvvm` flag and a `winuilib` library template).

Pick a preference via the `windevHelper.templates.source` setting (`auto`, `official`, or `community`). `auto` prefers the official pack when installed and falls back to the community pack.

## Installing Templates

### Automatic Installation

The extension will prompt you to install templates when:

- You try to create a new project without templates installed
- You try to add a new item without templates installed

### Manual Installation

Using VS Code:

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run **WinUI: Install WinUI Templates**

Using the terminal:

```bash
# Official Microsoft pack (recommended)
dotnet new install Microsoft.WindowsAppSDK.WinUI.CSharp.Templates

# Community pack
dotnet new install VijayAnand.WinUITemplates
```

### Updating Templates

```bash
dotnet new update
```

### Verifying Installation

```bash
dotnet new list winui
```

---

## Project Templates

### WinUI 3 Application (Blank)

**Template:** `winui`

Creates a WinUI 3 desktop application with MSIX packaging support.

**Usage:**

```bash
dotnet new winui -n MyApp
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name` | Project name | Required |
| `-mvvm` | (community pack only) Include MVVM Toolkit | false |
| `-o, --output` | Output directory | Current directory |

### WinUI 3 NavigationView App

**Template:** `winui-navview` *(official pack)*

```bash
dotnet new winui-navview -n MyApp
```

Starter shell built around `NavigationView` with a modern title bar and basic navigation structure.

### WinUI 3 TabView App

**Template:** `winui-tabview` *(official pack)*

```bash
dotnet new winui-tabview -n MyApp
```

Tab-based UI silhouette with add, remove, and drag support out of the box.

### WinUI 3 MVVM App

**Template:** `winui-mvvm` *(official pack)*

```bash
dotnet new winui-mvvm -n MyApp
```

Blank app pre-wired with `CommunityToolkit.Mvvm` and a working sample binding.

**With MVVM Toolkit (community pack):**

```bash
dotnet new winui -n MyApp -mvvm
```

This adds:

- CommunityToolkit.Mvvm package
- Base ViewModel class
- MVVM-structured code

**Project structure:**

```
MyApp/
├── Assets/
│   ├── LockScreenLogo.scale-200.png
│   ├── SplashScreen.scale-200.png
│   ├── Square150x150Logo.scale-200.png
│   ├── Square44x44Logo.scale-200.png
│   ├── Square44x44Logo.targetsize-24_altform-unplated.png
│   ├── StoreLogo.png
│   └── Wide310x150Logo.scale-200.png
├── Properties/
│   └── launchSettings.json
├── App.xaml
├── App.xaml.cs
├── MainWindow.xaml
├── MainWindow.xaml.cs
├── Package.appxmanifest
├── app.manifest
└── MyApp.csproj
```

---

### WinUI 3 Class Library

**Template:** `winuilib`

Creates a WinUI 3 class library for sharing controls and resources.

**Usage:**

```bash
dotnet new winuilib -n MyControls
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name` | Library name | Required |
| `-o, --output` | Output directory | Current directory |

**Project structure:**

```
MyControls/
├── Class1.cs
└── MyControls.csproj
```

---

## Item Templates

When adding item templates (Pages, User Controls, Windows) through VS Code, the extension automatically ensures MVVM support by creating or updating an `Imports.cs` file with global usings for CommunityToolkit.Mvvm. This enables ObservableObject, RelayCommand, and other MVVM patterns without manual using statements.

### Automatic MVVM Setup

When you add any view item, the extension:

1. Checks if `Imports.cs` exists in the project root
2. If missing, creates it with:
   ```csharp
   global using CommunityToolkit.Mvvm.ComponentModel;
   global using CommunityToolkit.Mvvm.Input;
   ```
3. Runs the template command to generate the XAML files

### XAML Page

**Template:** `winui-page`

Creates a new XAML page with code-behind.

**Usage:**

```bash
dotnet new winui-page -n SettingsPage
```

**Created files:**

- `SettingsPage.xaml`
- `SettingsPage.xaml.cs`

**VS Code:** Right-click folder → **WinUI: Add New Page**

**Example output:**

```xml
<!-- SettingsPage.xaml -->
<Page
    x:Class="MyApp.SettingsPage"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="using:MyApp"
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    mc:Ignorable="d">

    <Grid>
    </Grid>
</Page>
```

```csharp
// SettingsPage.xaml.cs
namespace MyApp;

public sealed partial class SettingsPage : Page
{
    public SettingsPage()
    {
        this.InitializeComponent();
    }
}
```

---

### XAML User Control

**Template:** `winui-usercontrol`

Creates a reusable XAML user control.

**Usage:**

```bash
dotnet new winui-usercontrol -n CardView
```

**Created files:**

- `CardView.xaml`
- `CardView.xaml.cs`

**VS Code:** Right-click folder → **WinUI: Add New User Control**

**Example output:**

```xml
<!-- CardView.xaml -->
<UserControl
    x:Class="MyApp.CardView"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="using:MyApp"
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    mc:Ignorable="d">

    <Grid>
    </Grid>
</UserControl>
```

---

### XAML Window

**Template:** `winui-window`

Creates a new application window.

**Usage:**

```bash
dotnet new winui-window -n SettingsWindow
```

**Created files:**

- `SettingsWindow.xaml`
- `SettingsWindow.xaml.cs`

**VS Code:** Right-click folder → **WinUI: Add New Window**

**Example output:**

```xml
<!-- SettingsWindow.xaml -->
<Window
    x:Class="MyApp.SettingsWindow"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="using:MyApp"
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    mc:Ignorable="d"
    Title="SettingsWindow">

    <Grid>
    </Grid>
</Window>
```

---

## Standard .NET Templates

In addition to WinUI-specific templates, you can use standard .NET templates:

### Class

```bash
dotnet new class -n MyClass
```

### Interface

```bash
dotnet new interface -n IMyService
```

### Global Using File

```bash
dotnet new globaljson
```

For a complete list:

```bash
dotnet new list
```

---

## Using Templates in VS Code

### Creating a Project

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run **WinUI: Create WinUI Project**
3. Enter the project name
4. Select MVVM option if desired
5. Choose the target folder

### Adding Items

1. Right-click a folder in the Explorer
2. Select the item type:
   - **WinUI: Add New Page**
   - **WinUI: Add New User Control**
   - **WinUI: Add New Window**
3. Enter the item name
4. Choose the target folder (**Current Folder**, **Project Folder**, or the category default such as **Views**) - the project directory is detected automatically
5. The files are created and opened

Or use the Command Palette:

1. `Ctrl+Shift+P`
2. Type "WinUI: Add New"
3. Select the item type

---

## Template Customization

### Custom Namespaces

Templates automatically use your project's root namespace. To change it, update your `.csproj`:

```xml
<PropertyGroup>
  <RootNamespace>MyCompany.MyApp</RootNamespace>
</PropertyGroup>
```

### Template Location

Templates are installed to:

```
%USERPROFILE%\.templateengine\dotnetcli\<version>\
```

---

## Troubleshooting

### Templates Not Found

```
Error: No templates found matching: 'winui'
```

**Solution:** Install the templates:

```bash
dotnet new install VijayAnand.WinUITemplates
```

### Wrong Namespace

If items are created with the wrong namespace:

1. Check your project's `<RootNamespace>` in `.csproj`
2. Verify you're in the correct directory when running the command

### Template Conflicts

If you have multiple template packages:

```bash
# List all installed templates
dotnet new list

# Uninstall conflicting packages
dotnet new uninstall <package-name>
```

---

## Resources

- [WinUI Templates GitHub](https://github.com/egvijayanand/winui-templates)
- [.NET CLI Templates Documentation](https://learn.microsoft.com/dotnet/core/tools/dotnet-new)
- [Custom Templates Guide](https://learn.microsoft.com/dotnet/core/tools/custom-templates)
