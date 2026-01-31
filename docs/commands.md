# Commands Reference

This document provides a complete reference for all commands available in the WinDev Helper extension.

## Project Creation Commands

### WinUI: Create WinUI Project

**Command ID:** `windev-helper.createProject`

Creates a new WinUI 3 application project.

**Usage:**

1. Opens a dialog to enter the project name
2. Asks whether to include MVVM Toolkit support
3. Prompts for the target folder location
4. Creates the project and offers to open it

**Equivalent CLI:**

```bash
dotnet new winui -n ProjectName
dotnet new winui -n ProjectName -mvvm  # with MVVM
```

---

### WinUI: Create WinUI Library

**Command ID:** `windev-helper.createLibrary`

Creates a new WinUI class library project.

**Usage:**

1. Opens a dialog to enter the library name
2. Prompts for the target folder location
3. Creates the library project

**Equivalent CLI:**

```bash
dotnet new winuilib -n LibraryName
```

---

## Item Template Commands

All item template commands automatically configure MVVM support by ensuring the project has an `Imports.cs` file with global usings for CommunityToolkit.Mvvm.

### WinUI: Add New Page

**Command ID:** `windev-helper.addPage`

Adds a new XAML page to your project.

**Usage:**

1. Right-click a folder in Explorer and select this command, or run from Command Palette
2. Enter the page name (without extension)
3. Creates `PageName.xaml` and `PageName.xaml.cs`
4. Automatically adds `Imports.cs` with MVVM global usings if not present

**Equivalent CLI:**

```bash
dotnet new winui-page -n PageName
```

---

### WinUI: Add New User Control

**Command ID:** `windev-helper.addUserControl`

Adds a new XAML user control to your project.

**Usage:**

1. Right-click a folder or use Command Palette
2. Enter the control name
3. Creates `ControlName.xaml` and `ControlName.xaml.cs`
4. Automatically adds `Imports.cs` with MVVM global usings if not present

**Equivalent CLI:**

```bash
dotnet new winui-usercontrol -n ControlName
```

---

### WinUI: Add New Window

**Command ID:** `windev-helper.addWindow`

Adds a new window to your project.

**Usage:**

1. Right-click a folder or use Command Palette
2. Enter the window name
3. Creates `WindowName.xaml` and `WindowName.xaml.cs`
4. Automatically adds `Imports.cs` with MVVM global usings if not present

**Equivalent CLI:**

```bash
dotnet new winui-window -n WindowName
```

---

## XAML Preview Commands (Preview Feature)

> ⚠️ These commands are for the preview feature in WinDev Helper 2.x.

### WinUI: Open XAML Preview

**Command ID:** `windev-helper.openXamlPreview`

Opens the native XAML preview panel for the current XAML file.

**Usage:**

1. Open a `.xaml` file in the editor
2. Run this command from the Command Palette
3. The preview panel opens beside your editor

**Features:**

- Real-time preview using the WinUI 3 rendering engine
- Click elements to navigate to their XAML definition
- Cursor position syncs between editor and preview
- Supports light and dark themes

**Note:** The native renderer is only available on Windows.

---

## Build Commands

Build commands support cancellation - you can cancel long-running builds using the cancel button in the progress notification.

### WinUI: Build Project

**Command ID:** `windev-helper.buildProject`

**Keyboard Shortcut:** `Ctrl+Shift+B`

Builds the current WinUI project with the selected configuration and platform.

**Output:** Build results appear in the "WinUI Build" output channel.

**Equivalent CLI:**

```bash
dotnet build -c Debug -p:Platform=x64
```

---

### WinUI: Rebuild Project

**Command ID:** `windev-helper.rebuildProject`

Cleans and rebuilds the current project.

**Equivalent CLI:**

```bash
dotnet clean
dotnet build
```

---

### WinUI: Clean Project

**Command ID:** `windev-helper.cleanProject`

Cleans build outputs from the project.

**Equivalent CLI:**

```bash
dotnet clean
```

---

## Debug & Run Commands

### WinUI: Debug Project

**Command ID:** `windev-helper.debugProject`

**Keyboard Shortcut:** `F5`

Builds the project (if necessary) and starts debugging.

**Features:**

- Builds with current configuration and platform
- Attaches the debugger
- Supports breakpoints and step debugging

---

### WinUI: Run Without Debugging

**Command ID:** `windev-helper.runWithoutDebugging`

**Keyboard Shortcut:** `Ctrl+F5`

Builds and runs the application without the debugger attached.

---

## Packaging Commands

### WinUI: Create MSIX Package

**Command ID:** `windev-helper.createMsixPackage`

Creates an MSIX package from your project.

**Usage:**

1. Select the output location for the package
2. The project is published and packaged
3. Optionally sign the package after creation

**Uses:** `winapp package` CLI command

---

### WinUI: Sign Package

**Command ID:** `windev-helper.signPackage`

Signs an MSIX package or executable with a certificate.

**Usage:**

1. Select the package file to sign
2. Select or specify the certificate file (.pfx)
3. Enter the certificate password
4. The package is signed with a timestamp

**Uses:** `winapp sign` CLI command

---

### WinUI: Generate Development Certificate

**Command ID:** `windev-helper.generateCertificate`

Generates a self-signed certificate for development.

**Usage:**

1. Enter the certificate subject name (e.g., CN=MyCompany)
2. Select the output location
3. Enter a password for the certificate

**Uses:** `winapp cert generate` CLI command

---

### WinUI: Install Certificate

**Command ID:** `windev-helper.installCertificate`

Installs a certificate to the local certificate store.

**Usage:**

1. Select the certificate file
2. The certificate is installed (may require elevation)

**Uses:** `winapp cert install` CLI command

---

## Identity & Manifest Commands

### WinUI: Create Debug Identity

**Command ID:** `windev-helper.createDebugIdentity`

Adds a temporary app identity for debugging packaged apps.

**Uses:** `winapp create-debug-identity` CLI command

---

### WinUI: Generate App Manifest

**Command ID:** `windev-helper.generateManifest`

Generates an AppxManifest.xml file for your project.

**Uses:** `winapp manifest generate` CLI command

---

### WinUI: Open App Manifest

**Command ID:** `windev-helper.openManifest`

Opens the Package.appxmanifest file in the editor.

---

## Package Management Commands

### WinUI: Restore Packages

**Command ID:** `windev-helper.restorePackages`

Restores NuGet packages for the project.

**Uses:** `winapp restore` CLI command

**Equivalent CLI:**

```bash
dotnet restore
```

---

### WinUI: Update Packages

**Command ID:** `windev-helper.updatePackages`

Updates NuGet packages to their latest versions.

**Uses:** `winapp update` CLI command

---

## Configuration Commands

### WinUI: Select Build Configuration

**Command ID:** `windev-helper.selectBuildConfiguration`

Shows a quick pick to select between Debug and Release configurations.

---

### WinUI: Select Target Platform

**Command ID:** `windev-helper.selectPlatform`

Shows a quick pick to select between x86, x64, and ARM64 platforms.

---

## Setup Commands

### WinUI: Install WinUI Templates

**Command ID:** `windev-helper.installTemplates`

Installs the WinUI project and item templates from NuGet.

**Equivalent CLI:**

```bash
dotnet new install VijayAnand.WinUITemplates
```

---

### WinUI: Initialize Project with Windows SDK

**Command ID:** `windev-helper.initializeProject`

Initializes a project with Windows SDK and App SDK references.

**Uses:** `winapp init` CLI command

---

### WinUI: Check WinApp CLI Installation

**Command ID:** `windev-helper.checkWinAppCli`

Verifies that the Windows App Development CLI is installed and accessible.

---

## Context Menu Commands

The following commands are available in the Explorer context menu when right-clicking on folders:

| Command | Menu Location |
|---------|---------------|
| Add New Page | Explorer context menu (folders) |
| Add New User Control | Explorer context menu (folders) |
| Add New Window | Explorer context menu (folders) |

## Command Palette Filtering

Commands that require an active WinUI project are only shown in the Command Palette when a WinUI project is detected in the workspace:

- Build Project
- Rebuild Project
- Clean Project
- Debug Project
- Run Without Debugging
- Create MSIX Package
