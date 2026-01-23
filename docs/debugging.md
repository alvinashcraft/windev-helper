# Debugging WinUI Apps

This guide covers debugging WinUI applications using the WinDev Helper extension.

## Quick Start

1. Open your WinUI project in VS Code
2. Set breakpoints by clicking in the gutter
3. Press `F5` to start debugging
4. Your app launches with the debugger attached

## Debug Configuration

### Default Configuration

The extension automatically creates a debug configuration when you press F5. It:

1. Detects your WinUI project
2. Uses the current build configuration (Debug/Release)
3. Uses the current platform (x86/x64/ARM64)
4. Builds the project if needed
5. Launches the app with the debugger

### Custom Launch Configuration

Create a `.vscode/launch.json` file for custom configurations:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "winui",
      "name": "WinUI: Debug",
      "request": "launch",
      "project": "${workspaceFolder}/MyApp.csproj",
      "configuration": "Debug",
      "platform": "x64"
    },
    {
      "type": "winui",
      "name": "WinUI: Release",
      "request": "launch",
      "project": "${workspaceFolder}/MyApp.csproj",
      "configuration": "Release",
      "platform": "x64"
    },
    {
      "type": "winui",
      "name": "WinUI: ARM64",
      "request": "launch",
      "project": "${workspaceFolder}/MyApp.csproj",
      "configuration": "Debug",
      "platform": "ARM64"
    }
  ]
}
```

### Configuration Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | Yes | Must be `"winui"` |
| `name` | string | Yes | Display name in the debug dropdown |
| `request` | string | Yes | Must be `"launch"` |
| `project` | string | Yes | Path to the .csproj file |
| `configuration` | string | No | `"Debug"` or `"Release"` |
| `platform` | string | No | `"x86"`, `"x64"`, or `"ARM64"` |
| `args` | string[] | No | Command line arguments |
| `stopAtEntry` | boolean | No | Break at entry point |
| `env` | object | No | Environment variables |

---

## Setting Breakpoints

### Line Breakpoints

Click in the gutter (left of line numbers) or press `F9` on a line.

### Conditional Breakpoints

1. Right-click the breakpoint
2. Select "Edit Breakpoint..."
3. Enter a condition (e.g., `count > 10`)

### Logpoints

Log messages without stopping:

1. Right-click in the gutter
2. Select "Add Logpoint..."
3. Enter a message (use `{expression}` for values)

### Exception Breakpoints

1. Open the Run and Debug view (`Ctrl+Shift+D`)
2. Expand "Breakpoints"
3. Enable exception types to break on

---

## Debugging Features

### Variables Panel

View and modify variables in the current scope:

- **Locals**: Variables in the current method
- **Watch**: Custom expressions to monitor
- **Call Stack**: Current execution path

### Debug Console

Execute expressions and commands:

```csharp
// Evaluate expressions
myVariable.ToString()

// Call methods
MyObject.DoSomething()

// View complex objects
JsonSerializer.Serialize(myObject)
```

### Step Controls

| Action | Keyboard | Description |
|--------|----------|-------------|
| Continue | `F5` | Resume execution |
| Step Over | `F10` | Execute current line |
| Step Into | `F11` | Enter function call |
| Step Out | `Shift+F11` | Exit current function |
| Restart | `Ctrl+Shift+F5` | Restart debugging |
| Stop | `Shift+F5` | Stop debugging |

---

## XAML Debugging

### Viewing the Visual Tree

While debugging:

1. The app's visual tree can be inspected
2. Use the Variables panel to explore UI elements
3. Check `this.Content` in window/page code-behind

### XAML Binding Errors

Binding errors appear in:

1. The Debug Console
2. The Output panel (Debug output)

Example error:

```
Error: BindingExpression path error: 'InvalidProperty' property not found
```

### Runtime XAML Inspection

Access XAML elements programmatically in the Debug Console:

```csharp
// Find an element by name
this.FindName("MyButton")

// Inspect element properties
((Button)this.FindName("MyButton")).Content
```

---

## Common Debugging Scenarios

### Debugging Startup Issues

1. Set a breakpoint in `App.xaml.cs` constructor
2. Set a breakpoint in `OnLaunched` method
3. Press F5 to debug

```csharp
public App()
{
    this.InitializeComponent(); // Set breakpoint here
}

protected override void OnLaunched(LaunchActivatedEventArgs args)
{
    // Set breakpoint here
}
```

### Debugging Event Handlers

```csharp
private void Button_Click(object sender, RoutedEventArgs e)
{
    // Set breakpoint here
    Debug.WriteLine("Button clicked");
}
```

### Debugging Async Code

Breakpoints work in async methods:

```csharp
private async Task LoadDataAsync()
{
    var data = await service.GetDataAsync(); // Breakpoint here
    this.DataList = data;
}
```

### Debugging Exceptions

1. Open Run and Debug view
2. Expand "Breakpoints"
3. Check "All Exceptions" or specific types

---

## Output Channels

### WinUI Build

Build output and errors:

1. View → Output (`Ctrl+Shift+U`)
2. Select "WinUI Build"

### WinApp CLI

CLI command output:

1. View → Output
2. Select "WinApp CLI"

### Debug Console

Application debug output:

- `Debug.WriteLine()` messages
- Binding errors
- Exception details

---

## Debugging Without the Extension

You can also use the standard .NET debugger:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "coreclr",
      "name": ".NET: Launch",
      "request": "launch",
      "program": "${workspaceFolder}/bin/x64/Debug/net8.0-windows10.0.19041.0/win-x64/MyApp.exe",
      "cwd": "${workspaceFolder}",
      "console": "internalConsole",
      "stopAtEntry": false
    }
  ]
}
```

---

## Troubleshooting

### Debugger Doesn't Attach

**Symptoms:** App launches but breakpoints don't hit

**Solutions:**

1. Ensure you're building in Debug configuration
2. Check that PDB files are being generated
3. Verify the correct project is being debugged

### Build Fails Before Debugging

**Solutions:**

1. Check the "WinUI Build" output channel for errors
2. Run `dotnet build` manually to see detailed errors
3. Restore packages: WinUI: Restore Packages

### Breakpoints Not Binding

**Symptoms:** Breakpoints show as empty circles

**Solutions:**

1. Build the project in Debug mode
2. Ensure symbols are loaded (check Debug Console)
3. Clean and rebuild the solution

### App Crashes on Start

**Solutions:**

1. Check for null reference exceptions in App.xaml.cs
2. Verify all required assets exist
3. Check the Package.appxmanifest for errors
4. Review Windows Event Viewer for crash details

### Slow Debugging

**Solutions:**

1. Disable "Just My Code" for faster stepping
2. Reduce the number of watched expressions
3. Close unused output channels

---

## Advanced Topics

### Remote Debugging

For remote Windows devices, use the Visual Studio Remote Debugger and configure a coreclr attach configuration.

### Mixed-Mode Debugging

For native/managed mixed debugging, additional tools may be required.

### Performance Profiling

Use the .NET profiling tools:

```bash
dotnet trace collect -p <PID>
dotnet counters monitor -p <PID>
```

---

## Resources

- [VS Code Debugging](https://code.visualstudio.com/docs/editor/debugging)
- [C# Debugging](https://code.visualstudio.com/docs/csharp/debugging)
- [WinUI Debugging Tips](https://learn.microsoft.com/windows/apps/winui/winui3/desktop-debugging)
