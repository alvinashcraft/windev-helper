# Configuration Guide

This document describes all configuration options available for the WinDev Helper extension.

## Extension Settings

Access these settings through:

- **File > Preferences > Settings** (or `Ctrl+,`)
- Search for "WinDev Helper" or "windevHelper"

### windevHelper.defaultConfiguration

**Type:** `string`

**Default:** `"Debug"`

**Options:** `"Debug"`, `"Release"`

**Description:** The default build configuration used when building or debugging WinUI projects.

```json
{
  "windevHelper.defaultConfiguration": "Debug"
}
```

**When to change:**

- Set to `Release` if you primarily work with release builds
- Use the status bar or command palette to temporarily switch configurations

---

### windevHelper.defaultPlatform

**Type:** `string`

**Default:** `"x64"`

**Options:** `"x86"`, `"x64"`, `"ARM64"`

**Description:** The default target platform for building WinUI projects.

```json
{
  "windevHelper.defaultPlatform": "x64"
}
```

**Platform considerations:**

- **x64**: Most common for modern Windows development
- **x86**: For 32-bit compatibility
- **ARM64**: For Windows on ARM devices

---

### windevHelper.winAppCliPath

**Type:** `string`

**Default:** `""`

**Description:** The path to the winapp CLI executable. Leave empty to use the CLI from your system PATH.

```json
{
  "windevHelper.winAppCliPath": "C:\\Tools\\winapp\\winapp.exe"
}
```

**When to set:**

- If you have multiple versions of the CLI installed
- If the CLI is not in your system PATH
- For portable installations

---

### windevHelper.autoRestoreOnOpen

**Type:** `boolean`

**Default:** `true`

**Description:** Automatically restore NuGet packages when opening a WinUI project.

```json
{
  "windevHelper.autoRestoreOnOpen": true
}
```

**When to disable:**

- If you prefer manual package restoration
- If restore operations are slow
- When working offline frequently

---

### windevHelper.showStatusBarItems

**Type:** `boolean`

**Default:** `true`

**Description:** Show build configuration and platform selectors in the VS Code status bar.

```json
{
  "windevHelper.showStatusBarItems": true
}
```

**Status bar items:**

- **Configuration indicator**: Shows "Debug" or "Release" with an icon
- **Platform indicator**: Shows "x86", "x64", or "ARM64"
- Clicking either opens a quick pick to change the value

---

### windevHelper.certificatePath

**Type:** `string`

**Default:** `""`

**Description:** Default path to the certificate file (.pfx) used for signing packages.

```json
{
  "windevHelper.certificatePath": "C:\\Certificates\\DevCert.pfx"
}
```

**When to set:**

- If you always use the same certificate for signing
- To speed up the signing workflow

---

## XAML Preview Settings (Preview Feature)

> ⚠️ These settings are for the preview XAML feature in WinDev Helper 2.x.

### windevHelper.preview.renderer

**Type:** `string`

**Default:** `"auto"`

**Options:** `"auto"`, `"native"`, `"html"`

**Description:** The renderer to use for XAML preview.

```json
{
  "windevHelper.preview.renderer": "auto"
}
```

**Options:**

- **auto**: Automatically selects the best renderer for your platform (native on Windows, HTML elsewhere)
- **native**: Uses the WinUI 3 rendering engine for accurate preview (Windows only)
- **html**: Uses an HTML-based approximation (cross-platform, less accurate)

---

### windevHelper.preview.width

**Type:** `number`

**Default:** `800`

**Description:** Default width of the XAML preview in pixels.

```json
{
  "windevHelper.preview.width": 1024
}
```

---

### windevHelper.preview.height

**Type:** `number`

**Default:** `600`

**Description:** Default height of the XAML preview in pixels.

```json
{
  "windevHelper.preview.height": 768
}
```

---

### windevHelper.preview.updateDelay

**Type:** `number`

**Default:** `300`

**Description:** Delay in milliseconds before updating the preview after editing XAML.

```json
{
  "windevHelper.preview.updateDelay": 500
}
```

**When to adjust:**

- Increase if preview updates cause performance issues
- Decrease for more responsive previews on fast machines

---

### windevHelper.preview.theme

**Type:** `string`

**Default:** `"auto"`

**Options:** `"auto"`, `"light"`, `"dark"`

**Description:** Theme for the XAML preview.

```json
{
  "windevHelper.preview.theme": "auto"
}
```

**Options:**

- **auto**: Follows VS Code theme, or uses project's App.xaml `RequestedTheme` if set
- **light**: Always use light theme
- **dark**: Always use dark theme

---

## Workspace Configuration

You can set project-specific configurations in your workspace settings (`.vscode/settings.json`):

```json
{
  "windevHelper.defaultConfiguration": "Release",
  "windevHelper.defaultPlatform": "ARM64",
  "windevHelper.autoRestoreOnOpen": false
}
```

This allows different projects to have different default settings.

---

## Launch Configuration

Configure debugging in `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "winui",
      "name": "WinUI: Launch",
      "request": "launch",
      "project": "${workspaceFolder}/MyApp.csproj",
      "configuration": "Debug",
      "platform": "x64"
    }
  ]
}
```

### Launch Configuration Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | Yes | Must be `"winui"` |
| `name` | string | Yes | Display name for the configuration |
| `request` | string | Yes | Must be `"launch"` |
| `project` | string | Yes | Path to the .csproj file |
| `configuration` | string | No | Build configuration (Debug/Release) |
| `platform` | string | No | Target platform (x86/x64/ARM64) |
| `args` | string[] | No | Command line arguments |
| `stopAtEntry` | boolean | No | Break at the entry point |

---

## Tasks Configuration

Configure build tasks in `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "winui",
      "task": "build",
      "configuration": "Debug",
      "platform": "x64",
      "label": "WinUI: Build Debug x64",
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "problemMatcher": ["$winui"]
    },
    {
      "type": "winui",
      "task": "package",
      "configuration": "Release",
      "platform": "x64",
      "label": "WinUI: Package Release",
      "group": "build"
    }
  ]
}
```

### Task Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | Yes | Must be `"winui"` |
| `task` | string | Yes | Task type: `build`, `rebuild`, `clean`, `package` |
| `configuration` | string | No | Build configuration |
| `platform` | string | No | Target platform |

---

## Environment Variables

The extension respects the following environment variables:

| Variable | Description |
|----------|-------------|
| `WINAPP_PATH` | Path to the winapp CLI executable |
| `DOTNET_ROOT` | Path to the .NET installation |

---

## Recommended Settings

### For Development

```json
{
  "windevHelper.defaultConfiguration": "Debug",
  "windevHelper.defaultPlatform": "x64",
  "windevHelper.autoRestoreOnOpen": true,
  "windevHelper.showStatusBarItems": true
}
```

### For CI/CD Builds

```json
{
  "windevHelper.defaultConfiguration": "Release",
  "windevHelper.autoRestoreOnOpen": false
}
```

### For ARM Development

```json
{
  "windevHelper.defaultPlatform": "ARM64"
}
```

---

## Troubleshooting Settings

### Reset to Defaults

To reset all settings to their defaults:

1. Open Settings (`Ctrl+,`)
2. Search for "windevHelper"
3. Click the gear icon next to each setting and select "Reset Setting"

### View Current Settings

To see all current settings:

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run "Preferences: Open Settings (JSON)"
3. Search for "windevHelper"

### Settings Not Taking Effect

If settings don't seem to apply:

1. Reload the window (`Ctrl+Shift+P` → "Developer: Reload Window")
2. Check for conflicting workspace settings
3. Verify the setting name is spelled correctly
