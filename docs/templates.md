# WinUI Templates Guide

This document covers the project and item templates available through the WinDev Helper extension.

## Overview

The extension uses the [WinUI Templates](https://github.com/egvijayanand/winui-templates) package by Vijay Anand to provide project and item templates. These templates create WinUI 3 projects and items that follow best practices.

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

### WinUI 3 Application

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
| `-mvvm` | Include MVVM Toolkit | false |
| `-o, --output` | Output directory | Current directory |

**With MVVM Toolkit:**

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
4. The files are created and opened

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
