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
│                       Service Locator                            │
│                    (Dependency Injection)                        │
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
│                       Utilities                                  │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │  Constants  │  │ Cancellation│                               │
│  └─────────────┘  └─────────────┘                               │
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

## Core Components

### Service Locator (`serviceLocator.ts`)

The extension uses a service locator pattern for dependency injection, providing:

- **Lazy initialization** - Services are created on-demand
- **Centralized access** - Single point of access to all services
- **Proper lifecycle management** - Coordinated disposal of all services

```typescript
class ServiceLocator {
    // Singleton access
    static initialize(context: vscode.ExtensionContext): ServiceLocator
    static get instance(): ServiceLocator
    static get isInitialized(): boolean
    
    // Core services (eagerly initialized when accessed)
    get winAppCli(): WinAppCli
    get projectManager(): WinUIProjectManager
    get buildManager(): BuildManager
    get statusBarManager(): StatusBarManager
    
    // Lazy services (initialized on first access)
    get packageManager(): PackageManager
    get templateManager(): TemplateManager
    
    // Lifecycle
    dispose(): void
}
```

### Constants (`constants.ts`)

Centralized configuration and magic strings:

```typescript
// Context keys for when clauses
export const CONTEXT_KEYS = { IS_WINUI_PROJECT: 'windevHelper.isWinUIProject' }

// Configuration section and property names
export const CONFIG = { SECTION: 'windevHelper', ... }

// Command identifiers
export const COMMANDS = { BUILD_PROJECT: 'windev-helper.buildProject', ... }

// Output channel names, debug types, file patterns, defaults
export const OUTPUT_CHANNELS = { ... }
export const DEBUG_TYPES = { ... }
export const FILE_PATTERNS = { ... }
export const DEFAULTS = { ... }
```

### Extension Entry Point (`extension.ts`)

The main entry point that:

- Initializes the service locator on activation
- Registers commands with VS Code using the service locator
- Performs non-blocking background initialization
- Properly disposes all services on deactivation

```typescript
export async function activate(context: vscode.ExtensionContext) {
    // Initialize the service locator
    services = ServiceLocator.initialize(context);
    
    // Register debug provider and commands
    // ...
    
    // Non-blocking background initialization
    initializeInBackground();
}

export function deactivate() {
    if (ServiceLocator.isInitialized) {
        services.dispose();
    }
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

Manages build operations and configuration with cancellation support:

```typescript
class BuildManager {
    // Properties
    currentConfiguration: BuildConfiguration  // Debug | Release
    currentPlatform: BuildPlatform            // x86 | x64 | ARM64
    
    // Events (for StatusBarManager integration)
    onConfigurationChanged: vscode.Event<BuildConfiguration>
    onPlatformChanged: vscode.Event<BuildPlatform>
    
    // Methods with optional cancellation token
    build(project: vscode.Uri, token?: CancellationToken): Promise<boolean>
    rebuild(project: vscode.Uri, token?: CancellationToken): Promise<boolean>
    clean(project: vscode.Uri, token?: CancellationToken): Promise<boolean>
    publish(project: vscode.Uri, rid?: string, token?: CancellationToken): Promise<boolean>
    runWithoutDebugging(project: vscode.Uri): Promise<void>
    
    // Build control
    cancelBuild(): void
}
```

**Cancellation Support:**

Build operations accept an optional `CancellationToken` parameter, allowing users to cancel long-running builds. When cancelled:
- The child process is terminated with SIGTERM
- The build returns `false`
- Output channel displays "Build was cancelled"
```

### Cancellation Utilities (`cancellation.ts`)

Provides utilities for cancellable async operations:

```typescript
// Result type for cancellable operations
interface CancellableResult<T> {
    success: boolean
    value?: T
    cancelled: boolean
    error?: Error
}

// Run a child process with cancellation support
function runCancellableProcess(
    command: string,
    args: string[],
    options: SpawnOptions,
    token?: CancellationToken
): Promise<CancellableResult<string>>

// Show progress with cancellation button
function withCancellableProgress<T>(
    title: string,
    task: (progress: Progress, token: CancellationToken) => Promise<T>
): Promise<T | undefined>

// Cancellable timeout utility
function cancellableTimeout(
    ms: number,
    token: CancellationToken
): Promise<boolean>
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

Manages project and item template operations with automatic global usings support:

```typescript
class TemplateManager {
    // Template installation
    installTemplates(): Promise<void>
    checkTemplatesInstalled(): Promise<boolean>
    
    // Project templates
    createProject(): Promise<void>
    createLibrary(): Promise<void>
    
    // Item templates (auto-adds global usings for MVVM)
    addPage(uri?: vscode.Uri): Promise<void>
    addUserControl(uri?: vscode.Uri): Promise<void>
    addWindow(uri?: vscode.Uri): Promise<void>
}
```

**Global Usings Management:**

When adding Pages, Controls, or Windows, the template manager automatically:
1. Checks for existing `Imports.cs` file
2. Creates it if missing with CommunityToolkit.Mvvm imports
3. Ensures MVVM patterns work without manual using statements

### Status Bar Manager (`statusBarManager.ts`)

Manages status bar UI elements with event-based synchronization:

```typescript
class StatusBarManager implements vscode.Disposable {
    // Display
    show(): void
    hide(): void
    
    // Updates
    updateConfiguration(config: string): void
    updatePlatform(platform: string): void
    
    // Event subscription (called from extension.ts)
    subscribeToEvents(buildManager: BuildManager): void
}
```

**Status Bar Items:**

- Configuration selector (Debug/Release)
- Platform selector (x86/x64/ARM64)

**Event-Based Synchronization:**

The StatusBarManager subscribes to BuildManager events to stay in sync:
```typescript
services.statusBarManager.subscribeToEvents(services.buildManager);
// Now status bar auto-updates when build config/platform changes
```

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
3. Runs `preLaunchTask: "winui: build"` (builds the project)
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
