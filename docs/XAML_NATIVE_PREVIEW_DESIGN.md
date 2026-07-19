# XAML Native Preview - Design Document

> **Historical document:** This describes the read-only preview architecture used before WinDev Helper 4.0. For the current editable custom editor and integrated Windows Preview mode, see [XAML Designer](xaml-designer.md) and [Extension Architecture](architecture.md#xaml-designer-architecture).

## Overview

This document describes the architecture for native WinUI XAML preview in VS Code, supporting both local Windows rendering and optional Azure-hosted remote rendering.

## Goals

1. **Pixel-perfect WinUI rendering** on Windows via native renderer
2. **Graceful fallback** to HTML approximation on non-Windows platforms
3. **Future Azure integration** for remote rendering (BYOA or hosted tier)
4. **Low latency** (<200ms for local, <500ms for remote)
5. **Custom control awareness** with clear messaging about limitations

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Extension                         │
├─────────────────────────────────────────────────────────────────┤
│  XamlPreviewPanel (Webview)                                     │
│  ├── Receives rendered images from renderer                     │
│  ├── Handles zoom, pan, selection overlay                       │
│  └── Displays error states and loading indicators               │
├─────────────────────────────────────────────────────────────────┤
│  XamlPreviewController                                          │
│  ├── Detects platform and renderer availability                 │
│  ├── Routes XAML to appropriate renderer                        │
│  ├── Manages renderer lifecycle                                 │
│  └── Handles debouncing and caching                             │
├─────────────────────────────────────────────────────────────────┤
│  Renderer Abstraction (IXamlRenderer)                           │
│  ├── LocalNativeRenderer (Windows only)                         │
│  ├── AzureRemoteRenderer (optional, any platform)               │
│  └── HtmlFallbackRenderer (existing, any platform)              │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Local Native    │  │ Azure Container │  │ HTML Renderer   │
│ Renderer        │  │ App (Future)    │  │ (Fallback)      │
│                 │  │                 │  │                 │
│ WinUI Host App  │  │ Same WinUI app  │  │ XAML → HTML/CSS │
│ Named Pipe IPC  │  │ REST/WebSocket  │  │ In-process      │
│ PNG output      │  │ PNG output      │  │ HTML output     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Components

### 1. XamlPreviewController (TypeScript)

Central orchestrator that:
- Detects available renderers on startup
- Selects the best renderer based on platform and user settings
- Manages XAML change debouncing (300ms default)
- Caches recent renders to avoid redundant work
- Handles renderer process lifecycle

```typescript
interface IXamlRenderer {
  readonly type: 'native' | 'azure' | 'html';
  readonly available: boolean;
  readonly supportsCustomControls: boolean;
  
  initialize(): Promise<void>;
  render(xaml: string, options: RenderOptions): Promise<RenderResult>;
  dispose(): void;
}

interface RenderOptions {
  width: number;
  height: number;
  theme: 'light' | 'dark';
  scale: number;  // For high-DPI
  projectPath?: string;  // For custom control resolution
}

interface RenderResult {
  type: 'image' | 'html';
  data: string;  // Base64 PNG or HTML string
  elementMappings?: ElementMapping[];  // For click-to-source
  warnings?: string[];  // e.g., "Custom control X not rendered"
  renderTimeMs: number;
}
```

### 2. LocalNativeRenderer (TypeScript + C#)

**TypeScript side:**
- Manages the native renderer process lifecycle
- Communicates via named pipe (Windows) for low latency
- Sends XAML, receives PNG + metadata
- Auto-restarts on crash

**C# WinUI app (XamlPreviewHost.exe):**
- Headless WinUI 3 application
- Listens on named pipe for render requests
- Dynamically loads XAML into a hidden window
- Captures rendered content as PNG via RenderTargetBitmap
- Returns PNG bytes + element position metadata

### 3. AzureRemoteRenderer (Future)

- REST/WebSocket client to Azure Container App
- Same request/response format as local
- Supports both "hosted by extension author" and "bring your own Azure"
- Settings:
  ```json
  {
    "windevHelper.preview.azure.enabled": true,
    "windevHelper.preview.azure.endpoint": "https://...",
    "windevHelper.preview.azure.apiKey": "..."
  }
  ```

### 4. HtmlFallbackRenderer

- Supports 69 WinUI controls with HTML/CSS approximations
- Used when:
  - Running on macOS/Linux without Azure configured
  - Native renderer fails to start
  - User explicitly prefers HTML preview
- Control coverage includes layout panels, input controls, navigation, pickers, shapes, icons, dialogs, and more
- Unknown controls render as labeled placeholder boxes

## Native Renderer Protocol

### Named Pipe Communication

Pipe name: `\\.\pipe\WinDevHelper.XamlPreview.{sessionId}`

### Request Format (JSON)

```json
{
  "type": "render",
  "requestId": "uuid",
  "xaml": "<Page>...</Page>",
  "options": {
    "width": 800,
    "height": 600,
    "theme": "dark",
    "scale": 1.5,
    "projectPath": "C:\\Projects\\MyApp"
  }
}
```

### Response Format (JSON + Binary)

```json
{
  "type": "renderResult",
  "requestId": "uuid",
  "success": true,
  "imageBase64": "iVBORw0KGgo...",
  "imageWidth": 1200,
  "imageHeight": 900,
  "elements": [
    {
      "id": "Button1",
      "name": "SubmitButton",
      "type": "Button",
      "bounds": { "x": 100, "y": 200, "width": 120, "height": 32 },
      "xamlLine": 15,
      "xamlColumn": 8
    }
  ],
  "warnings": [],
  "renderTimeMs": 45
}
```

### Error Response

```json
{
  "type": "renderResult",
  "requestId": "uuid",
  "success": false,
  "error": {
    "code": "XAML_PARSE_ERROR",
    "message": "Invalid property 'Conent' on Button",
    "line": 15,
    "column": 12
  }
}
```

## Native Renderer App (C# WinUI)

### Project Structure

```
native-renderer/
├── XamlPreviewHost/
│   ├── XamlPreviewHost.csproj
│   ├── App.xaml
│   ├── App.xaml.cs
│   ├── Program.cs
│   ├── Services/
│   │   ├── PipeServer.cs
│   │   ├── XamlRenderer.cs
│   │   └── ElementMapper.cs
│   └── Properties/
│       └── launchSettings.json
└── XamlPreviewHost.sln
```

### Key Implementation Details

1. **Headless Mode**: App starts without visible window, runs as background process
2. **XAML Loading**: Uses `XamlReader.Load()` to parse XAML at runtime
3. **Rendering**: Creates offscreen window, renders to `RenderTargetBitmap`
4. **Element Mapping**: Walks visual tree to map elements back to XAML source positions
5. **Theme Support**: Applies light/dark theme based on VS Code theme
6. **Crash Recovery**: Isolated rendering with try/catch, process restart on fatal error

### Custom Control Limitations

For v1, we **do not** attempt to load user's custom controls because:
1. Requires building user's project
2. Assembly loading is complex (dependencies, architecture)
3. Potential security concerns

Instead, custom controls render as placeholder boxes with the control name, similar to the HTML fallback.

Future versions could:
- Watch for project builds and hot-reload assemblies
- Use a sidecar process that builds a "preview host" project referencing user's code

## Extension Settings

```json
{
  "windevHelper.preview.renderer": {
    "type": "string",
    "enum": ["auto", "native", "azure", "html"],
    "default": "auto",
    "description": "XAML preview renderer. 'auto' uses native on Windows, HTML elsewhere."
  },
  "windevHelper.preview.azure.enabled": {
    "type": "boolean",
    "default": false,
    "description": "Enable Azure-hosted remote rendering (requires endpoint configuration)"
  },
  "windevHelper.preview.azure.endpoint": {
    "type": "string",
    "default": "",
    "description": "Azure XAML renderer endpoint URL"
  },
  "windevHelper.preview.azure.apiKey": {
    "type": "string",
    "default": "",
    "description": "API key for Azure XAML renderer"
  },
  "windevHelper.preview.updateDelay": {
    "type": "number",
    "default": 300,
    "description": "Delay in ms before updating preview after XAML changes"
  }
}
```

## User Experience

### Status Indicators

The preview panel header shows:
- 🟢 **Native** - Using local WinUI renderer
- 🔵 **Azure** - Using remote Azure renderer
- 🟡 **HTML** - Using HTML approximation (may differ from actual rendering)
- 🔴 **Error** - Renderer failed, showing last successful render or error message

### Warnings

When limitations apply, show non-intrusive warnings:
- "Custom control 'MyButton' rendered as placeholder"
- "StaticResource 'MyBrush' not found, using default"
- "Azure rendering may differ slightly from local Windows rendering"

## Development Phases

### Phase 1: Local Native Renderer (This Branch)
- [ ] Create WinUI renderer host app
- [ ] Implement named pipe communication
- [ ] Basic XAML rendering (no custom controls)
- [ ] Element mapping for click-to-source
- [ ] VS Code integration with renderer abstraction
- [ ] Fallback to HTML on non-Windows

### Phase 2: Polish & Edge Cases
- [ ] Handle XAML parse errors gracefully
- [ ] Theme switching support
- [ ] High-DPI / scaling support
- [ ] Render caching
- [ ] Process lifecycle management (start/stop/restart)

### Phase 3: Azure Remote Renderer
- [ ] Container App setup with same WinUI renderer
- [ ] REST API wrapper
- [ ] BYOA configuration
- [ ] Hosted tier infrastructure

### Phase 4: Advanced Features
- [ ] Custom control support (assembly loading)
- [ ] Resource dictionary resolution
- [ ] Live property editing in preview
- [ ] Design-time data support

## Security Considerations

1. **Local renderer**: Runs with same permissions as VS Code, no additional risk
2. **Azure renderer**: 
   - API key stored in VS Code settings (secret storage preferred)
   - HTTPS only
   - No user data stored server-side
   - Rate limiting to prevent abuse
3. **XAML execution**: Never executes user code events (Click handlers, etc.)

## Testing Strategy

1. **Unit tests**: XAML parsing, element mapping, protocol serialization
2. **Integration tests**: End-to-end render of sample XAML files
3. **Visual regression**: Compare rendered output against baseline images
4. **Platform tests**: Verify fallback behavior on macOS/Linux

---

*Last updated: 2026-01-31*
