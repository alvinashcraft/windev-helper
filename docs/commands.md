# Commands Reference

This document provides a complete reference for all commands available in the WinDev Helper extension.

## Project Creation Commands

### WinUI: Create WinUI Project

**Command ID:** `windev-helper.createProject`

Creates a new WinUI 3 application project.

**Usage:**

1. Opens a dialog to enter the project name
2. With the official Microsoft template pack: pick from **Blank**, **NavigationView**, **TabView**, **MVVM**, or **Unit Test**
3. With the community pack: choose whether to include MVVM Toolkit support
4. Prompts for the target folder location
5. Creates the project and offers to open it

**Equivalent CLI (official pack):**

```bash
dotnet new winui          -n ProjectName
dotnet new winui-navview  -n ProjectName
dotnet new winui-tabview  -n ProjectName
dotnet new winui-mvvm     -n ProjectName
dotnet new winui-unittest -n ProjectName
```

**Equivalent CLI (community pack):**

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
# Official pack
dotnet new winui-lib -n LibraryName

# Community pack
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
3. Choose the target folder (**Current Folder**, **Project Folder**, or the **Views** folder) - the project directory is detected automatically
4. Creates `PageName.xaml` and `PageName.xaml.cs`
5. Automatically adds `Imports.cs` with MVVM global usings if not present

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
3. Choose the target folder (**Current Folder**, **Project Folder**, or the **Views/Controls** folder) - the project directory is detected automatically
4. Creates `ControlName.xaml` and `ControlName.xaml.cs`
5. Automatically adds `Imports.cs` with MVVM global usings if not present

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
3. Choose the target folder (**Current Folder**, **Project Folder**, or the **Views** folder) - the project directory is detected automatically
4. Creates `WindowName.xaml` and `WindowName.xaml.cs`
5. Automatically adds `Imports.cs` with MVVM global usings if not present

**Equivalent CLI:**

```bash
dotnet new winui-window -n WindowName
```

---

### WinUI: Add New Content Dialog

**Command ID:** `windev-helper.addDialog`

Adds a new `ContentDialog` to your project. Requires the official Microsoft template pack.

**Equivalent CLI:**

```bash
dotnet new winui-dialog -n DialogName
```

---

### WinUI: Add New Templated Control

**Command ID:** `windev-helper.addTemplatedControl`

Adds a new templated (custom) control with its `Themes/Generic.xaml` style entry. Requires the official Microsoft template pack.

**Equivalent CLI:**

```bash
dotnet new winui-templatedcontrol -n ControlName
```

---

### WinUI: Add New Resource Dictionary

**Command ID:** `windev-helper.addResourceDictionary`

Adds a new `ResourceDictionary` XAML file to your project. Requires the official Microsoft template pack.

**Equivalent CLI:**

```bash
dotnet new winui-resourcedictionary -n DictionaryName
```

---

### WinUI: Install WinUI Agent + Skills Plugin

**Command ID:** `windev-helper.installCopilotPlugin`

Helper that sets up the [WinUI agent plugin](https://devblogs.microsoft.com/ifdef-windows/build-native-windows-apps-with-ai-agents-for-winui-and-windows-app-sdk/) from the [microsoft/win-dev-skills](https://github.com/microsoft/win-dev-skills) marketplace for the GitHub Copilot CLI and Claude Code.

**Usage:**

1. Run from the Command Palette
2. Pick **Install in Terminal** to open a new terminal that runs the marketplace add + install commands, **Copy Commands** to just copy them, or **Open Docs** to read the win-dev-skills repository
3. The commands that run are:

   ```text
   copilot plugin marketplace add microsoft/win-dev-skills
   copilot plugin install winui@win-dev-skills
   ```

4. Start a new Copilot session and run `/winui-setup` to configure your environment

---

### WinUI: Open WinUI Agent Skills Repository

**Command ID:** `windev-helper.openSkillsRepo`

Opens the [microsoft/win-dev-skills](https://github.com/microsoft/win-dev-skills) repository in your browser.

---

### WinUI: Check Windows Dev Environment

**Command ID:** `windev-helper.checkDevEnvironment`

Runs a diagnostic check of your local Windows development toolchain and reports the results in the **WinDev Environment** output channel.

**Checks:**

- **.NET SDK** — verifies a version ≥ 8 is installed (target 10)
- **WinApp CLI** — verifies version ≥ 0.3
- **WinUI templates** — verifies the `Microsoft.WindowsAppSDK.WinUI.CSharp.Templates` package is installed
- **Developer Mode** — verifies Windows Developer Mode is enabled (Windows only)

Each failed check includes the command needed to fix it.

---

## Reactor Commands

> Microsoft.UI.Reactor is an experimental declarative pure-C# UI framework for WinUI. See the [documentation](https://microsoft.github.io/microsoft-ui-reactor/) and [repository](https://github.com/microsoft/microsoft-ui-reactor).

### WinUI: Create Reactor App

**Command ID:** `windev-helper.createReactorApp`

Scaffolds a new Reactor app via the `dotnet new reactorapp` template (registered by the Reactor bootstrap).

**Equivalent CLI:**

```bash
dotnet new reactorapp -n AppName
```

---

### WinUI: Reactor: Run Bootstrap

**Command ID:** `windev-helper.runReactorBootstrap`

Builds the Reactor framework, packs the `mur` CLI global tool, and registers the `dotnet new reactorapp` template from a local clone of `microsoft/microsoft-ui-reactor` via `bootstrap.ps1`.

Set `windevHelper.reactor.repoPath` to point at your clone, or you will be prompted to select it.

---

### WinUI: Reactor: Open Documentation

**Command ID:** `windev-helper.openReactorDocs`

Opens the [Microsoft.UI.Reactor documentation](https://microsoft.github.io/microsoft-ui-reactor/) in your browser.

---

### WinUI: Reactor: Install Agent Plugin

**Command ID:** `windev-helper.installReactorPlugin`

Installs the Reactor agent plugin for the GitHub Copilot CLI from the `microsoft/microsoft-ui-reactor` marketplace.

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
- For unpackaged apps: attaches the debugger with full breakpoint support
- For MSIX-packaged apps: deploys the package and launches through the package identity (without debugger attachment)
- Supports breakpoints and step debugging (unpackaged apps only)

---

### WinUI: Run Without Debugging

**Command ID:** `windev-helper.runWithoutDebugging`

**Keyboard Shortcut:** `Ctrl+F5`

Builds and runs the application without the debugger attached.

**Behavior by app type:**

- **Unpackaged apps** (`WindowsPackageType=None`): Uses `dotnet run` to launch
- **Packaged apps** (default MSIX): Builds, deploys the MSIX package via `Add-AppxPackage -Register`, and launches through the package identity using `shell:AppsFolder`

---

## XAML Properties Pane Commands (Preview Feature)

> ⚠️ These commands are for the preview feature in WinDev Helper 2.5.

The Properties pane appears in the XAML panel when editing `.xaml` files. It displays properties for the currently selected XAML element.

### WinDev: Refresh Properties

**Command ID:** `windevHelper.propertyPane.refresh`

Refreshes the Properties pane to reflect the latest XAML content.

---

### WinDev: Toggle Property Grouping

**Command ID:** `windevHelper.propertyPane.toggleGrouping`

Switches between grouped view (properties organized by category like Layout, Appearance, Common, etc.) and a flat alphabetical list.

---

### WinDev: Toggle Default Properties

**Command ID:** `windevHelper.propertyPane.toggleDefaults`

Toggles display of default (unset) properties. When enabled, shows all available properties for the selected control type from the built-in metadata database (~85 WinUI control types). Default values appear dimmed to distinguish them from explicitly set values.

---

### WinDev: Copy Value

**Command ID:** `windevHelper.propertyPane.copyValue`

Copies the value of the selected property to the clipboard. Available from the context menu on property items.

---

### WinDev: Go to Definition

**Command ID:** `windevHelper.propertyPane.goToDefinition`

Navigates to the property's definition in the XAML source. Available from the context menu on property items.

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

### WinUI: View Certificate Info

**Command ID:** `windev-helper.certificateInfo`

Displays detailed information about a PFX certificate, including subject, issuer, and validity dates.

**Usage:**

1. Select the PFX certificate file to inspect
2. Enter the certificate password
3. Certificate details are shown in the WinUI Packaging output channel

**Uses:** `winapp cert info` CLI command (v0.2.1+)

---

## Identity & Manifest Commands

### WinUI: Create Debug Identity

**Command ID:** `windev-helper.createDebugIdentity`

Adds a temporary app identity for debugging packaged apps.

**Uses:** `winapp create-debug-identity` CLI command

---

## Microsoft Store Commands

These commands enable publishing and managing apps in the Microsoft Store directly from VS Code. They use the `winapp store` subcommand which wraps the Microsoft Store Developer CLI.

> **Prerequisite:** Configure your Store credentials first using **WinDev: Configure Microsoft Store Credentials**.

### WinDev: Configure Microsoft Store Credentials

**Command ID:** `windev-helper.storeConfigure`

Configures authentication for Microsoft Store operations. Prompts for:

- Azure AD Tenant ID
- Partner Center Seller ID
- Azure AD Application (Client) ID
- Client Secret

**Uses:** `winapp store reconfigure` CLI command

---

### WinDev: List Microsoft Store Apps

**Command ID:** `windev-helper.storeListApps`

Lists all applications registered in your Microsoft Store account. Results appear in the WinUI Packaging output channel.

**Uses:** `winapp store apps list` CLI command

---

### WinDev: Publish to Microsoft Store

**Command ID:** `windev-helper.storePublish`

Publishes an application to the Microsoft Store. Supports:

- **Full release** - 100% rollout to all users
- **Gradual rollout** - Specify a percentage (1-100%) of users
- **Draft only** - Create submission without committing

**Uses:** `winapp store publish` CLI command

---

### WinDev: Check Store Submission Status

**Command ID:** `windev-helper.storeSubmissionStatus`

Checks the current status of a Store submission. Prompts for the Store Product ID.

**Uses:** `winapp store submission status` CLI command

---

### WinDev: Create External Catalog

**Command ID:** `windev-helper.createExternalCatalog`

Creates an external catalog for streamlined asset management across applications.

**Uses:** `winapp create-external-catalog` CLI command

---

## Run & Automation Commands

These commands provide packaged app launch and UI automation capabilities. They require winapp CLI v0.3.0 or later.

### WinDev: Run as Packaged App

**Command ID:** `windev-helper.runPackagedApp`

Launches an application as a packaged app from a build output folder. Prompts for:

1. Build output folder containing your compiled app
2. Run mode: normal, detached, or with debug output
3. Whether to unregister the package on exit

**Uses:** `winapp run` CLI command

---

### WinDev: Unregister Dev Package

**Command ID:** `windev-helper.unregisterPackage`

Removes a sideloaded dev package registered by `winapp run`. Runs in the context of the current project. Prompts for an optional package name (leave empty to let the CLI discover it).

**Uses:** `winapp unregister` CLI command

---

### WinDev: Add App Execution Alias

**Command ID:** `windev-helper.manifestAddAlias`

Adds a `uap5:AppExecutionAlias` to the manifest so a packaged app can be launched by name from the command line.

**Usage:**

1. Enter the alias name (e.g., "myapp")
2. The manifest is automatically discovered from the current project
3. The alias is added to the manifest

**Uses:** `winapp manifest add-alias` CLI command (v0.3.0+)

---

### WinDev: UI: List Windows

**Command ID:** `windev-helper.uiListWindows`

Lists visible top-level windows. Optionally filter by app name. On winapp CLI v0.4.0+, you can also include hidden/untitled zero-size windows (`--show-hidden`). Results appear in the WinUI Packaging output channel.

**Uses:** `winapp ui list-windows` CLI command

---

### WinDev: UI: Inspect App

**Command ID:** `windev-helper.uiInspect`

Walks the full UI Automation tree of a running app. Prompts for the app name.

**Uses:** `winapp ui inspect` CLI command

---

### WinDev: UI: Take Screenshot

**Command ID:** `windev-helper.uiScreenshot`

Captures a screenshot of an app window. Prompts for the app name and output file location.

**Uses:** `winapp ui screenshot` CLI command

---

### WinDev: UI: Hover Element

**Command ID:** `windev-helper.uiHover`

Triggers hover behavior for a UI element (tooltip/flyout/visual state changes). Prompts for selector, optional app filter, and optional dwell time.

**Uses:** `winapp ui hover` CLI command (v0.4.0+)

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

Notes:

1. The extension runs `init` with non-interactive defaults for reliable command execution.
2. On winapp CLI v0.4.0+, non-interactive mode requires an explicit base directory; the extension now supplies it automatically.

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
