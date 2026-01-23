# Extension Architecture

This document provides an overview of the WinDev Helper extension architecture for developers and contributors.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Extension                         │
├─────────────────────────────────────────────────────────────────┤
│                         extension.ts                             │
│                     (Entry Point & Command Registration)         │
├─────────────────────────────────────────────────────────────────┤
│                           Managers                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Project   │  │    Build    │  │   Package   │             │
│  │   Manager   │  │   Manager   │  │   Manager   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Template   │  │  StatusBar  │  │    Debug    │             │
│  │   Manager   │  │   Manager   │  │   Provider  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                        WinApp CLI                                │
│                    (CLI Wrapper Layer)                           │
├─────────────────────────────────────────────────────────────────┤
│                      External Tools                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  winapp CLI │  │  dotnet CLI │  │  Templates  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Extension Entry Point (`extension.ts`)

The main entry point that:

- Activates on workspace containing `.csproj` files
- Initializes all manager components
- Registers commands with VS Code
- Sets up event handlers and watchers

```typescript
export async function activate(context: vscode.ExtensionContext) {
    // Initialize managers
    winAppCli = new WinAppCli();
    projectManager = new WinUIProjectManager(context, winAppCli);
    // ... register commands
}
```

### WinApp CLI Wrapper (`winAppCli.ts`)

Provides a TypeScript interface to the Windows App Development CLI:

```typescript
class WinAppCli {
    // Setup commands
    init(): Promise<void>
    restore(): Promise<void>
    update(): Promise<void>
    
    // Packaging commands
    package(options: PackageOptions): Promise<void>
    sign(options: SignOptions): Promise<void>
    
    // Certificate commands
    generateCertificate(options: CertificateOptions): Promise<void>
    installCertificate(path: string): Promise<void>
    
    // Manifest commands
    manifest(action: string): Promise<void>
    createDebugIdentity(): Promise<void>
}
```

### Project Manager (`projectManager.ts`)

Handles project detection and workspace management:

```typescript
class WinUIProjectManager {
    // Properties
    isWinUIProject: boolean
    currentProject: vscode.Uri
    
    // Methods
    detectWinUIProject(): Promise<boolean>
    getProjectInfo(): Promise<ProjectInfo>
    getAllProjects(): Promise<vscode.Uri[]>
    openManifest(): Promise<void>
}
```

**Detection Logic:**

1. Scans workspace for `.csproj` files
2. Checks for WinUI indicators:
   - `<UseWinUI>true</UseWinUI>`
   - `Microsoft.WindowsAppSDK` reference
   - Windows target framework

### Build Manager (`buildManager.ts`)

Manages build operations and configuration:

```typescript
class BuildManager {
    // Properties
    currentConfiguration: BuildConfiguration  // Debug | Release
    currentPlatform: BuildPlatform            // x86 | x64 | ARM64
    
    // Methods
    build(project: vscode.Uri): Promise<boolean>
    rebuild(project: vscode.Uri): Promise<boolean>
    clean(project: vscode.Uri): Promise<boolean>
    runWithoutDebugging(project: vscode.Uri): Promise<void>
    publish(project: vscode.Uri): Promise<boolean>
}
```

### Package Manager (`packageManager.ts`)

Handles MSIX packaging and signing:

```typescript
class PackageManager {
    // Package operations
    createMsixPackage(project: vscode.Uri): Promise<void>
    signPackage(path?: string): Promise<void>
    
    // Certificate operations
    generateCertificate(): Promise<void>
    installCertificate(): Promise<void>
    
    // Identity operations
    createDebugIdentity(project: vscode.Uri): Promise<void>
    generateManifest(project: vscode.Uri): Promise<void>
}
```

### Template Manager (`templateManager.ts`)

Manages project and item template operations:

```typescript
class TemplateManager {
    // Template installation
    installTemplates(): Promise<void>
    checkTemplatesInstalled(): Promise<boolean>
    
    // Project templates
    createProject(): Promise<void>
    createLibrary(): Promise<void>
    
    // Item templates
    addPage(uri?: vscode.Uri): Promise<void>
    addUserControl(uri?: vscode.Uri): Promise<void>
    addWindow(uri?: vscode.Uri): Promise<void>
}
```

### Status Bar Manager (`statusBarManager.ts`)

Manages status bar UI elements:

```typescript
class StatusBarManager {
    // Display
    show(): void
    hide(): void
    
    // Updates
    updateConfiguration(config: string): void
    updatePlatform(platform: string): void
}
```

**Status Bar Items:**

- Configuration selector (Debug/Release)
- Platform selector (x86/x64/ARM64)

### Debug Configuration Provider (`debugConfigurationProvider.ts`)

Provides debug configuration for WinUI apps:

```typescript
class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder,
        config: vscode.DebugConfiguration
    ): Promise<vscode.DebugConfiguration>
    
    provideDebugConfigurations(
        folder: vscode.WorkspaceFolder
    ): vscode.ProviderResult<vscode.DebugConfiguration[]>
}
```

**Debug Flow:**

1. User presses F5
2. Provider creates/resolves configuration
3. Build manager builds the project
4. Converts `winui` type to `coreclr`
5. VS Code launches the debugger

---

## Data Flow

### Project Detection

```
Workspace Open
      │
      ▼
File Watcher Trigger
      │
      ▼
Scan for .csproj files
      │
      ▼
Check for WinUI indicators
      │
      ▼
Set Context (windevHelper.isWinUIProject)
      │
      ▼
Update UI (Status Bar, Commands)
```

### Build Process

```
Build Command
      │
      ▼
Get Current Configuration/Platform
      │
      ▼
Execute dotnet build
      │
      ▼
Parse Output → Problem Matcher
      │
      ▼
Report Result
```

### Debug Process

```
F5 / Debug Command
      │
      ▼
Resolve Debug Configuration
      │
      ▼
Build Project (if needed)
      │
      ▼
Get Executable Path
      │
      ▼
Convert to coreclr Config
      │
      ▼
VS Code Debugger Launch
```

---

## Extension Points

### Commands

Registered in `package.json` and implemented in `extension.ts`:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "windev-helper.buildProject",
        "title": "Build Project",
        "category": "WinUI"
      }
    ]
  }
}
```

### Configuration

Settings defined in `package.json`:

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "windevHelper.defaultConfiguration": {
          "type": "string",
          "default": "Debug"
        }
      }
    }
  }
}
```

### Task Provider

Custom task type for WinUI builds:

```json
{
  "contributes": {
    "taskDefinitions": [
      {
        "type": "winui",
        "required": ["task"],
        "properties": {
          "task": { "type": "string" }
        }
      }
    ]
  }
}
```

### Debug Configuration

Custom debugger type:

```json
{
  "contributes": {
    "debuggers": [
      {
        "type": "winui",
        "label": "WinUI"
      }
    ]
  }
}
```

---

## Dependencies

### Extension Dependencies

```json
{
  "extensionDependencies": [
    "ms-dotnettools.csharp",
    "ms-dotnettools.csdevkit"
  ]
}
```

### External Tools

| Tool | Purpose |
|------|---------|
| `winapp` | Windows App Development CLI |
| `dotnet` | .NET CLI for builds |
| WinUI Templates | Project/item templates |

---

## Event Handling

### File System Events

```typescript
// Watch for project file changes
fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.csproj');
fileWatcher.onDidCreate(() => detectWinUIProject());
fileWatcher.onDidDelete(() => detectWinUIProject());
```

### Configuration Changes

```typescript
vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('windevHelper')) {
        // Reload settings
    }
});
```

---

## Error Handling

### CLI Errors

```typescript
try {
    await winAppCli.execute(command);
} catch (error) {
    vscode.window.showErrorMessage(`Command failed: ${error.message}`);
    this.outputChannel.appendLine(`Error: ${error.stack}`);
}
```

### User Feedback

- Progress notifications for long operations
- Error messages with action buttons
- Output channels for detailed logs

---

## Testing Strategy

### Unit Tests

Test individual managers in isolation:

```typescript
suite('BuildManager', () => {
    test('should return correct runtime identifier', () => {
        const manager = new BuildManager(mockCli);
        manager._currentPlatform = 'ARM64';
        assert.strictEqual(manager.getRuntimeIdentifier(), 'win-arm64');
    });
});
```

### Integration Tests

Test with actual VS Code APIs:

```typescript
suite('Extension Integration', () => {
    test('should detect WinUI project', async () => {
        const detected = await projectManager.detectWinUIProject();
        assert.strictEqual(detected, true);
    });
});
```

---

## Future Considerations

### Planned Features

1. XAML IntelliSense integration
2. Hot Reload support
3. C++ WinUI project support
4. Additional project templates

### Extension Points for Future

- Custom template providers
- Additional debugger types
- Package format plugins
